// Строка версии внизу экранов; версия берётся из package.json при сборке
export default function Version() {
  return <p className="version">Alpha-Claude v{import.meta.env.VITE_APP_VERSION}</p>;
}
