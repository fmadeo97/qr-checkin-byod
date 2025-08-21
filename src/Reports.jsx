// src/Reports.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { listSites } from "./api"; // ya lo tienes

const query = new URLSearchParams(window.location.search);
const orgId = (query.get("org") || "DIMEO").trim();

export default function Reports() {
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => new Date(new Date().setDate(new Date().getDate()-7)).toISOString().slice(0,10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { (async () => setSites(await listSites(orgId)))(); }, []);

  async function load() {
    setLoading(true);
    try {
      // armamos rango [from 00:00, to 23:59]
      const from = new Date(dateFrom + "T00:00:00Z").toISOString();
      const to = new Date(dateTo + "T23:59:59Z").toISOString();

      // Trae eventos + joins de nombres (PostgREST)
      let q = supabase
        .from("events")
        .select("ts,type,distance_m,lat,lng,selfie_url, site:sites(name), user:users(name)")
        .eq("org_id", orgId)
        .gte("ts", from)
        .lte("ts", to)
        .order("ts", { ascending: false });

      if (siteId) q = q.eq("site_id", siteId);

      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error("load reports error:", e);
      alert("Could not load data.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* auto al entrar */ }, []);

  function exportCSV() {
    const header = ["timestamp","type","site","user","distance_m","lat","lng","selfie_url"];
    const lines = [header.join(",")].concat(
      rows.map(r => [
        r.ts,
        r.type,
        JSON.stringify(r.site?.name || ""),
        JSON.stringify(r.user?.name || ""),
        r.distance_m ?? "",
        r.lat ?? "",
        r.lng ?? "",
        r.selfie_url ?? ""
      ].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `events_${dateFrom}_${dateTo}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  const totalIn = useMemo(() => rows.filter(r => r.type === "check-in").length, [rows]);
  const totalOut = useMemo(() => rows.filter(r => r.type === "check-out").length, [rows]);

  return (
    <div className="container">
      <header className="topbar">
        <div className="brand">DIMEO</div>
        <div className="subtitle">Reports</div>
      </header>

      <section className="card">
        <div className="grid2">
          <label>
            <div className="label">From</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          </label>
          <label>
            <div className="label">To</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
          </label>
          <label>
            <div className="label">Site</div>
            <select value={siteId} onChange={e=>setSiteId(e.target.value)}>
              <option value="">All sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <button className="btn" onClick={load} disabled={loading}>{loading? "Loading…":"Refresh"}</button>
          <button className="btn primary" onClick={exportCSV} disabled={!rows.length}>Export CSV</button>
        </div>
        <div className="hint" style={{marginTop:8}}>
          Results: <b>{rows.length}</b> · IN: <b>{totalIn}</b> · OUT: <b>{totalOut}</b>
        </div>
      </section>

      <section className="card">
        <div className="label">Events</div>
        <div style={{ overflowX:"auto" }}>
          <table className="striped" style={{ width:"100%", fontSize:14 }}>
            <thead>
              <tr>
                <th>Timestamp</th><th>Type</th><th>Site</th><th>User</th>
                <th>Dist (m)</th><th>Lat</th><th>Lng</th>
              </tr>
            </thead>
            <tbody>
              {rows.length===0 && <tr><td colSpan={7} style={{textAlign:"center", padding:16}}>No data.</td></tr>}
              {rows.map((r,i)=>(
                <tr key={i}>
                  <td>{new Date(r.ts).toLocaleString()}</td>
                  <td>{r.type}</td>
                  <td>{r.site?.name || ""}</td>
                  <td>{r.user?.name || ""}</td>
                  <td>{r.distance_m ?? ""}</td>
                  <td>{r.lat?.toFixed?.(6) ?? ""}</td>
                  <td>{r.lng?.toFixed?.(6) ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
