import Compass from './components/Compass';
import ErrorBoundary from './components/ErrorBoundary';
import UpdatePrompt from './components/UpdatePrompt';

function App() {
  return (
    <ErrorBoundary>
      <Compass />
      <UpdatePrompt />
    </ErrorBoundary>
  );
}

export default App;
