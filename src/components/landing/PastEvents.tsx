import Image from "next/image";

import blueprint from "@/assets/landing/events/blueprint.png";
import campfireFlagship from "@/assets/landing/events/campfire-flagship.png";
import midnight from "@/assets/landing/events/midnight.jpg";
import siege from "@/assets/landing/events/siege.png";
import orphWowCute from "@/assets/landing/emotes/orph-wowcute.png";
import { useTranslations } from "next-intl";

const events = [
  {
    key: "flagship",
    image: campfireFlagship,
    decoration: false,
    href: "https://flagship.hackclub.com/",
  },
  {
    key: "midnight",
    image: midnight,
    decoration: true,
    href: "https://midnight.hackclub.com/",
  },
  {
    key: "blueprint",
    image: blueprint,
    decoration: false,
    href: "https://blueprint.hackclub.com/",
  },
  {
    key: "siege",
    image: siege,
    decoration: false,
    href: "https://siege.hackclub.com/",
  },
] as const;

export default function PastEvents() {
  const t = useTranslations("landing.past-events");

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <h2 className="text-4xl md:text-5xl font-jersey">{t("title")}</h2>
      <div className="leading-relaxed text-xl md:text-2xl  text-pretty space-y-4 mt-4">
        <p>
          {t.rich("0", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p>
          {t.rich("1", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </div>
      <div className="mt-8 group grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-12">
        {events.map((event) => (
          <a
            key={event.key}
            href={event.href}
            target="_blank"
            className="block group/link group-has-hover:opacity-50 group-has-focus:opacity-50 hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <div className="relative">
              <Image
                src={event.image}
                alt=""
                className="w-full aspect-3/2 object-cover border-[0.75rem] border-white shadow-lg transition-transform group-hover/link:scale-102 group-hover/link:rotate-2 group-focus/link:scale-102 group-focus/link:rotate-2"
                placeholder="blur"
                sizes="(max-width: 1024px) calc(100vw - 6rem), 36rem"
              />
              {event.decoration && (
                <Image
                  src={orphWowCute}
                  alt=""
                  role="presentation"
                  className="h-24 -left-8 -bottom-8 -rotate-3 -scale-x-100 absolute w-auto"
                  placeholder="blur"
                  sizes="6rem"
                />
              )}
            </div>
            <p className="mt-6 text-xl font-bold">{t(`${event.key}.title`)}</p>
            <p className="mt-1 text-xl">{t(`${event.key}.desc`)}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
