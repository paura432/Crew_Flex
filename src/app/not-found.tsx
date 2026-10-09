import { ButtonLink } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <StateMessage
        title="Not found"
        description="This page does not exist or you do not have access to it."
        action={<ButtonLink href="/app">Back to Crew Flex</ButtonLink>}
      />
    </main>
  );
}
