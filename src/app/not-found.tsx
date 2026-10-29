import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <StateMessage
        heading
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
        action={<ButtonLink href="/app">{t("backToApp")}</ButtonLink>}
      />
    </main>
  );
}
