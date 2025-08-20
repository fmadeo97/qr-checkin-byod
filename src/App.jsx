import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { listSites, listUsers, uploadSelfie, insertEvent, getLastEvent } from './api';

// ORG por URL (?org=DIMEO) con fallback a DIMEO
const query = new URLSearchParams(window.location.search);
const orgId = (query.get('org') || 'DIMEO').trim();

// Distancia Haversine (m)
function haversineMeters(a, b) {
  const toRad = (x) => (x * Math.PI) / 180, R = 6371000;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function App() {
  const [sites, setSites] = useState([]);
  const [users, setUsers] = useState([]);
  const [gps, setGps] = useState(null);
  const [site, setSite] = useState(null);
  const [distance, setDistance] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [nameInput, setNameInput] = useState("");

  const [photo, setPhoto] = useState(null);
  const webcamRef = useRef(null);

  // 1) Cargar sedes y usuarios por ORG
  useEffect(() => {
    (async () => {
      setSites(await listSites(orgId));
      setUsers(await listUsers(orgId));
    })();
  }, [orgId]);

  // 2) GPS + elegir sede dentro de radio automáticamente
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(loc);
        if (sites.length > 0) {
          const ranked = sites.map(s => {
            const d = Math.round(haversineMeters(loc, { lat: s.lat, lng: s.lng }));
            return { ...s, _dist: d };
          }).sort((a,b) => a._dist - b._dist);
          const candidate = ranked[0];
          if (candidate && candidate._dist <= candidate.radius_m) {
            setSite(candidate);
            setDistance(candidate._dist);
          } else {
            setSite(null);
            setDistance(candidate?._dist ?? null);
          }
        }
      },
      (err) => console.error('GPS error', err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sites]);

  // 3) Tomar selfie
  const takePhoto = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return alert('No se pudo capturar la selfie.');
    setPhoto(imageSrc);
  };

  // 4) Confirmar (alterna IN/OUT)
  const confirm = async () => {
    if (!site) return alert('Debes estar dentro de la sede para registrar.');
    if (!selectedUser) return alert('Selecciona tu nombre.');
    if (!photo) return alert('La selfie es obligatoria.');

    const blob = await fetch(photo).then(r => r.blob());
    const selfieUrl = await uploadSelfie(blob, orgId, selectedUser.id);
    const last = await getLastEvent(orgId, selectedUser.id, site.id);
    const type = last && last.type === 'check-in' ? 'check-out' : 'check-in';

    await insertEvent({
      org_id: orgId,
      site_id: site.id,
      user_id: selectedUser.id,
      type,
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
      distance_m: distance ?? null,
      selfie_url: selfieUrl
    });

    alert(`✅ ${type.toUpperCase()} en ${site.name}`);
    // reset para próximo uso
    setNameInput("");
    setSelectedUser(null);
    setPhoto(null);
  };

  // Render
  const usersFiltered = users.filter(u =>
    u.name.toLowerCase().includes(nameInput.toLowerCase())
  );

  return (
    <div style={{ fontFamily:'system-ui, sans-serif', padding:20, maxWidth:520, margin:'0 auto' }}>
      <h2 style={{ marginBottom:8 }}>DIMEO – Check‑in / Check‑out</h2>
      <div style={{ fontSize:13, color:'#555' }}>
        Usa este enlace desde el QR impreso. Permití cámara y ubicación.
      </div>

      <div style={{ marginTop:16, padding:12, border:'1px solid #eee', borderRadius:10 }}>
        <div style={{ fontSize:14 }}>
          Org: <b>{orgId}</b><br/>
          {gps && <>Mi GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}<br/></>}
          Sede: {site
            ? <b>{site.name} — {distance} m</b>
            : <span style={{ color:'#b00' }}>Fuera de sede
                {distance!=null ? ` (la más cercana a ${distance} m)` : ''}</span>}
        </div>
      </div>

      {/* Paso 1: Usuario */}
      <div style={{ marginTop:16 }}>
        <label style={{ fontSize:14 }}>Tu nombre</label>
        <input
          value={nameInput}
          onChange={(e) => {
            const val = e.target.value;
            setNameInput(val);
            const match = users.find(u => u.name.toLowerCase() === val.toLowerCase());
            setSelectedUser(match || null);
          }}
          placeholder="Empieza a escribir…"
          style={{ width:'100%', padding:10, border:'1px solid #ccc', borderRadius:8, marginTop:6 }}
          list="user-suggestions"
        />
        <datalist id="user-suggestions">
          {usersFiltered.slice(0,20).map(u => (
            <option key={u.id} value={u.name} />
          ))}
        </datalist>
        {!selectedUser && nameInput && (
          <div style={{ marginTop:6, fontSize:12, color:'#555' }}>
            Selecciona tu nombre de la lista.
          </div>
        )}
      </div>

      {/* Paso 2: Selfie */}
      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:14, marginBottom:6 }}>Selfie (obligatoria)</div>
        {!photo ? (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width="100%"
              videoConstraints={{ facingMode: 'user' }}
            />
            <button onClick={takePhoto} style={{ marginTop:8, padding:10, border:'1px solid #ccc', borderRadius:8, width:'100%' }}>
              📸 Tomar selfie
            </button>
          </>
        ) : (
          <>
            <img src={photo} alt="selfie" style={{ width:'100%', borderRadius:8 }} />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={() => setPhoto(null)} style={{ flex:1, padding:10, border:'1px solid #ccc', borderRadius:8 }}>
                Repetir
              </button>
              <button onClick={confirm} style={{ flex:1, padding:10, border:'1px solid #0a0', color:'#0a0', borderRadius:8 }}>
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>

      {/* Nota de validación */}
      {!site && (
        <div style={{ marginTop:12, fontSize:12, color:'#b00' }}>
          Debes estar dentro del radio de una sede para registrar.
          Si estás en el lugar y no te detecta, amplía temporalmente <code>radius_m</code> en Supabase.
        </div>
      )}
    </div>
  );
}
