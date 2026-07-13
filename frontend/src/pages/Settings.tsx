import React, { useState } from 'react';
import Topbar from '../components/Topbar';
import api from '../api/axios';
import { Upload, Shield, Hash, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('cert');
  
  // Certificate state
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  
  // Software Credentials state
  const [softwareId, setSoftwareId] = useState('');
  const [softwarePin, setSoftwarePin] = useState('');
  const [testSetId, setTestSetId] = useState('');

  // Numbering Range state
  const [resolutionNumber, setResolutionNumber] = useState('');
  const [prefix, setPrefix] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [authDate, setAuthDate] = useState('');
  const [validTo, setValidTo] = useState('');

  const handleCertUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certFile) return;
    
    const formData = new FormData();
    formData.append('file', certFile);
    formData.append('password', certPassword);

    try {
      await api.post('/certificates', formData);
      alert('Certificado subido exitosamente (Encriptado en DB)');
      setCertFile(null);
      setCertPassword('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al subir certificado');
    }
  };

  const handleCredsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/software-credentials', {
        softwareId,
        softwarePin,
        testSetId,
        environment: 'habilitacion'
      });
      alert('Credenciales de Software guardadas');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar credenciales');
    }
  };

  const handleRangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/numbering-ranges', {
        prefix,
        resolutionNumber,
        fromNumber: parseInt(fromNumber),
        toNumber: parseInt(toNumber),
        authorizationDate: authDate,
        validTo: validTo,
        documentType: '01',
        technicalKey: 'TEST_KEY' // Mocked for UI simplicity
      });
      alert('Rango de numeración guardado');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar rango');
    }
  };

  return (
    <div className="animate-fade-in">
      <Topbar title="Configuración" />

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div className="card" style={{ width: '250px', height: 'fit-content', padding: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className={`btn ${activeTab === 'cert' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', border: 'none' }}
              onClick={() => setActiveTab('cert')}
            >
              <Shield size={18} /> Certificado Digital
            </button>
            <button 
              className={`btn ${activeTab === 'creds' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', border: 'none' }}
              onClick={() => setActiveTab('creds')}
            >
              <SettingsIcon size={18} /> Software DIAN
            </button>
            <button 
              className={`btn ${activeTab === 'ranges' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', border: 'none' }}
              onClick={() => setActiveTab('ranges')}
            >
              <Hash size={18} /> Rangos de Numeración
            </button>
          </div>
        </div>

        <div className="card" style={{ flex: 1 }}>
          
          {activeTab === 'cert' && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Subir Certificado Digital (.p12)</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                Tu certificado será almacenado y encriptado utilizando el servicio KMS nativo. 
                Se utilizará para firmar los XML antes de enviarlos a la DIAN.
              </p>
              
              <form onSubmit={handleCertUpload}>
                <div className="input-group">
                  <label className="input-label">Archivo de Certificado (.p12 / .pfx)</label>
                  <div style={{ border: '2px dashed var(--border-color)', padding: '2rem', textAlign: 'center', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: 'var(--bg-color)' }}>
                    <input 
                      type="file" 
                      accept=".p12,.pfx"
                      style={{ display: 'none' }} 
                      id="cert-upload"
                      onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="cert-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <Upload size={32} color="var(--text-secondary)" />
                      <span>{certFile ? certFile.name : 'Haz clic para seleccionar o arrastra el archivo aquí'}</span>
                    </label>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Contraseña del Certificado</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="••••••••" 
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    required 
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Guardar Certificado</button>
              </form>
            </div>
          )}

          {activeTab === 'creds' && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Credenciales de Software DIAN</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                Configura el ID del software y el PIN asignado por la DIAN. Si estás en pruebas, incluye el TestSetId.
              </p>
              
              <form onSubmit={handleCredsSubmit}>
                <div className="input-group">
                  <label className="input-label">ID del Software (UUID)</label>
                  <input type="text" className="input-field" value={softwareId} onChange={e=>setSoftwareId(e.target.value)} placeholder="e.g. 9b9a..." required />
                </div>
                <div className="input-group">
                  <label className="input-label">PIN del Software</label>
                  <input type="text" className="input-field" value={softwarePin} onChange={e=>setSoftwarePin(e.target.value)} placeholder="12345" required />
                </div>
                <div className="input-group">
                  <label className="input-label">TestSetId (Opcional - Sólo para Habilitación)</label>
                  <input type="text" className="input-field" value={testSetId} onChange={e=>setTestSetId(e.target.value)} placeholder="e.g. fd23..." />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Guardar Credenciales</button>
              </form>
            </div>
          )}

          {activeTab === 'ranges' && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Rangos de Numeración</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                Registra la resolución de facturación otorgada por la DIAN.
              </p>
              
              <form onSubmit={handleRangeSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Número de Resolución</label>
                    <input type="text" className="input-field" value={resolutionNumber} onChange={e=>setResolutionNumber(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Prefijo</label>
                    <input type="text" className="input-field" value={prefix} onChange={e=>setPrefix(e.target.value)} placeholder="SETP" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Número Inicial</label>
                    <input type="number" className="input-field" value={fromNumber} onChange={e=>setFromNumber(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Número Final</label>
                    <input type="number" className="input-field" value={toNumber} onChange={e=>setToNumber(e.target.value)} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Fecha de Autorización</label>
                    <input type="date" className="input-field" value={authDate} onChange={e=>setAuthDate(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Válida Hasta</label>
                    <input type="date" className="input-field" value={validTo} onChange={e=>setValidTo(e.target.value)} required />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Guardar Rango</button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
