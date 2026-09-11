// src/styles/compassStyles.js

export const getAccuracyColor = (acc) => {
  if (!acc) return '#8e8e93';
  if (acc <= 15) return '#34C759';
  if (acc <= 50) return '#FF9500';
  return '#FF3B30';
};

export const cardStyle = {
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderRadius: '16px',
  padding: '20px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
  width: '100%',
  maxWidth: '340px',
  marginBottom: '50px',
  boxSizing: 'border-box'
};

export const inputStyle = {
  width: '100%', 
  padding: '12px', 
  margin: '8px',
  borderRadius: '10px', 
  border: '1px solid #d1d1d6',
  background: '#f2f2f7', 
  fontSize: '15px', 
  boxSizing: 'border-box',
  outline: 'none', 
  fontFamily: 'inherit'
};

export const buttonStyle = {
  width: '100%', 
  marginTop: '10px', 
  marginBottom: '30px', 
  padding: '12px', 
  background: '#34C759', 
  color: 'white', 
  border: 'none', 
  borderRadius: '10px', 
  cursor: 'pointer', 
  fontWeight: '600', 
  fontSize: '16px', 
  maxWidth: '300px',
};

export const selectStyle = {
  width: '100%', padding: '12px', 
  margin: '8px 0',
  borderRadius: '10px', 
  border: '1px solid #d1d1d6',
  background: '#fff', 
  fontSize: '15px', 
  boxSizing: 'border-box',
  outline: 'none', 
  fontFamily: 'inherit'
};

export const containerStyle = {
	marginTop: '10px',
	marginBottom: '10px',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
  padding: '30px 15px',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  color: '#1c1c1e',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  boxSizing: 'border-box'
};

export const versionBadgeStyle = {
  marginTop: 'auto',
  fontSize: '12px',
  color: '#8e8e93',
  opacity: 0.7,
  textAlign: 'center',
  width: '100%',
  paddingBottom: '10px'
};

// Стили заголовка на экране запуска
export const titleStyle = {
  fontSize: '28px',
  fontWeight: '700',
  marginBottom: '30px',
  color: '#1c1c1e',
  textAlign: 'center'
};
