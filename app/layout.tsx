import type { Metadata } from "next";
import { SiteChrome } from "../components/SiteChrome";
import "./globals.css";
import "./client-corrections.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://saitmagnitov.ru"),
  title: {
    default: "Сайт Магнитов — неодимовые магниты оптом и в розницу",
    template: "%s | Сайт Магнитов",
  },
  description:
    "Неодимовые магниты, магнитные крепления и поисковые магниты с доставкой по России.",
  applicationName: "Сайт Магнитов",
  keywords: [
    "неодимовые магниты",
    "купить магниты",
    "магниты оптом",
    "магнитные крепления",
    "поисковые магниты",
  ],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Сайт Магнитов",
    title: "Неодимовые магниты для бизнеса и частных задач",
    description:
      "Более 6000 артикулов, опт от 30 000 ₽ и доставка по России.",
    images: [
      {
        url: "/og.png",
        width: 1672,
        height: 941,
        alt: "Сайт Магнитов — неодимовые магниты для бизнеса и частных задач",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Сайт Магнитов",
    description:
      "Неодимовые магниты оптом и в розницу с доставкой по России.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/assets/logo.png",
    shortcut: "/assets/logo.png",
  },
};

const themeScript = `
  try {
    const saved = localStorage.getItem('saitmagnitov-theme');
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    document.documentElement.dataset.theme = saved || preferred;
  } catch (_) {
    document.documentElement.dataset.theme = 'light';
  }
`;

const yandexMetrikaScript = `
  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j=0;j<document.scripts.length;j++) {
      if (document.scripts[j].src===r) return;
    }
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,
    a.parentNode.insertBefore(k,a)
  })(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=34581830","ym");

  ym(34581830,"init",{
    ssr:true,
    clickmap:true,
    accurateTrackBounce:true,
    trackLinks:true
  });
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: yandexMetrikaScript }} />
      </head>
      <body>
        <noscript>
          <div>
            {/* Yandex Metrika requires a raw tracking pixel when JavaScript is disabled. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mc.yandex.ru/watch/34581830"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
