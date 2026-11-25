import { changeSubmission } from "./actions";

export function SubmissionAction({ id, operation, filters, children }: {
  id: string;
  operation: "open" | "unread" | "invoice" | "uninvoice";
  filters: string;
  children: React.ReactNode;
}) {
  return (
    <form action={changeSubmission}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value={operation} />
      <input type="hidden" name="filters" value={filters} />
      <button className={`admin-button${operation === "open" ? " admin-primary" : ""}`}>{children}</button>
    </form>
  );
}
