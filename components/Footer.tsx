import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <img src="/assets/logo-site-dark.webp" alt="Сайт Магнитов" />
            <p>
              Неодимовые магниты оптом и в розницу. Работаем с 2013 года. Склад
              в Красногорске, 6 000 артикулов, документы в день оплаты.
            </p>
          </div>
          <div>
            <h2>Навигация</h2>
            <Link href="/catalog">Каталог</Link>
            <Link href="/otrasli">По отраслям</Link>
            <Link href="/opt">Опт и дилерам</Link>
            <Link href="/delivery">Как заказать</Link>
            <Link href="/reviews">Отзывы</Link>
            <Link href="/favorites">Избранное</Link>
            <Link href="/cart">Корзина</Link>
            <Link href="/privacy">Политика конфиденциальности</Link>
          </div>
          <div>
            <h2>Каталог</h2>
            <Link href="/catalog/category/diski">Диски и цилиндры</Link>
            <Link href="/catalog/category/pryamougolnye">Прямоугольные</Link>
            <Link href="/catalog/category/kolca">Кольца и шайбы</Link>
            <Link href="/catalog/category/poiskovye">Поисковые магниты</Link>
            <Link href="/catalog/category/krepleniya">
              Крепления и держатели
            </Link>
          </div>
          <div>
            <h2>Контакты</h2>
            <p>
              Московская обл., Красногорск, Пятницкое шоссе 6-й км, с9, СК
              «Бумеранг»
            </p>
            <p>Пн–Пт 8:00–17:00 МСК</p>
            <a href="tel:+74951207567">+7 (495) 120-75-67</a>
            <a href="mailto:info@smagn.ru">info@smagn.ru</a>
            <a
              href="https://www.ozon.ru/seller/rumag-3898271/"
              target="_blank"
              rel="noreferrer"
            >
              Магазин на Ozon
            </a>
            <a
              href="https://www.wildberries.ru/seller/250083964"
              target="_blank"
              rel="noreferrer"
            >
              Магазин на Wildberries
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          © 2013–2026 saitmagnitov · Все права защищены
          <br />
          ИП Морозов Михаил Евгеньевич · 325200000096856
        </div>
      </div>
    </footer>
  );
}
