import Screen from './Screen';
import { goBack } from '../utils/router';

// Заглушка: способ поддержки появится позже (донаты на сайте, покупки в магазинах приложений)
export default function SupportScreen() {
  return (
    <Screen title="Поддержать проект" backLabel="Назад в меню" onBack={() => goBack('menu')}>
      <section className="panel">
        <h2 className="label">Скоро</h2>
        <p className="screen__text">
          Здесь появится возможность поддержать развитие Компаса. Спасибо, что пользуетесь приложением!
        </p>
        <button type="button" className="btn btn--secondary btn--block" onClick={() => goBack('menu')}>Назад</button>
      </section>
    </Screen>
  );
}
