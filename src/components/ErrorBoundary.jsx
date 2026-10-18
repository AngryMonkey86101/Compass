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
        <section className="panel panel--active fatal" role="alert">
          <h1 className="label tone-danger">Сбой приложения</h1>
          <p className="empty">Что-то пошло не так. Сохранённые точки не пострадали.</p>
          <button type="button" className="btn btn--block" onClick={() => window.location.reload()}>
            Перезагрузить
          </button>
        </section>
      </main>
    );
  }
}
