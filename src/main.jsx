import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Reports from './Reports.jsx'
import './style.css'

// leer query param
const query = new URLSearchParams(window.location.search)
const showReports = query.get('reports') === '1'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {showReports ? <Reports /> : <App />}
  </React.StrictMode>
)
