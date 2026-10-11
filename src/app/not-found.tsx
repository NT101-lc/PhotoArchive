import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { IconArrowLeft, IconImage } from "@/components/Icons";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <EmptyState
        icon={<IconImage size={26} />}
        title={t.notFound.title}
        action={
          <Link href="/" className="btn btn-primary">
            <IconArrowLeft size={16} /> {t.common.backHome}
          </Link>
        }
      >
        {t.notFound.body}
      </EmptyState>
    </main>
  );
}
