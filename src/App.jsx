import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { listSites, listUsers, uploadSelfie, insertEvent, getLastEvent } from './api';

// ORG via URL (?org=DIMEO), fallback to DIMEO
const query = new URLSearchParams(window.location.search);
const orgId = (query.get('org') || 'DIMEO').trim();

// Haversine distance (m)
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

  const [nameInput, setNameInput] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const webcamRef = useRef(null);

  // 1) Load sites and users (by org)
  useEffect(() => {
    (async () => {
      setSites(await listSites(orgId));
      setUsers(await listUsers(orgId));
    })();
  }, [orgId]);

  // 2) GPS + auto-pick nearest site within radius
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
      (err) => console.error('Geolocation error', err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sites]);

  // 3) Take selfie
  const takePhoto = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return alert('Could not capture the selfie. Please allow camera access.');
    setPhoto(imageSrc);
  };

  // 4) Confirm (toggle IN/OUT)
  const confirm = async () => {
    if (!site) return alert('You must be inside a site geofence to register.');
    if (!selectedUser) return alert('Please select your name.');
    if (!photo) return alert('Selfie is required.');

    try {
      setBusy(true);
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

      alert(`✅ ${type.toUpperCase()} at ${site.name}`);
      // reset
      setNameInput('');
      setSelectedUser(null);
      setPhoto(null);
    } catch (e) {
      console.error(e);
      alert('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const usersFiltered = users.filter(u =>
    u.name.toLowerCase().includes(nameInput.toLowerCase())
  );

  return (
    <div className="container">
      <header className="topbar">
        <div className="brand">DIMEO</div>
        <div className="subtitle">Check‑in / Check‑out</div>
      </header>

      <section className="card">
        <div className="muted">
          Use your phone to open this page (scan the printed QR). Please allow camera and location.
        </div>
        <div className="grid2">
          <div>
            <div className="label">Organization</div>
            <div className="value">{orgId}</div>
          </div>
          <div>
            <div className="label">Site</div>
            <div className="value">
              {site ? (
                <b>{site.name} — {distance} m</b>
              ) : (
                <span className="warn">
                  Outside geofence{distance!=null ? ` (nearest ~${distance} m)` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        {gps && (
          <div className="gps">My location: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</div>
        )}
      </section>

      {/* Step 1: User */}
      <section className="card">
        <div className="label">Your name</div>
        <input
          value={nameInput}
          onChange={(e) => {
            const val = e.target.value;
            setNameInput(val);
            const match = users.find(u => u.name.toLowerCase() === val.toLowerCase());
            setSelectedUser(match || null);
          }}
          placeholder="Start typing…"
          list="user-suggestions"
        />
        <datalist id="user-suggestions">
          {usersFiltered.slice(0, 20).map(u => (
            <option key={u.id} value={u.name} />
          ))}
        </datalist>
        {!selectedUser && nameInput && (
          <div className="hint">Pick your name from the list.</div>
        )}
      </section>

      {/* Step 2: Selfie */}
      <section className="card">
        <div className="label">Selfie (required)</div>
        {!photo ? (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width="100%"
              videoConstraints={{ facingMode: 'user' }}
              className="webcam"
            />
            <button className="btn" onClick={takePhoto}>📸 Take selfie</button>
          </>
        ) : (
          <>
            <img src={photo} alt="selfie" className="shot" />
            <div className="actions">
              <button className="btn secondary" onClick={() => setPhoto(null)}>Retake</button>
              <button className="btn primary" onClick={confirm} disabled={busy}>
                {busy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </>
        )}
        {!site && (
          <div className="hint warn">
            You must be inside the site range to Sign In / Out.
          </div>
        )}
      </section>

      <footer className="foot">
        © DIMEO
      </footer>
    </div>
  );
}
