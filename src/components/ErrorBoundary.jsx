import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Необработанная ошибка приложения:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="app">
        <p role="alert" className="error">Что-то пошло не так.</p>
        <button type="button" className="btn btn--large" onClick={() => window.location.reload()}>
          Перезагрузить
        </button>
      </main>
    );
  }
}
