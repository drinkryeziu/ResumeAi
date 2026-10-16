export const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export const formatDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    typeof d === "string" ? new Date(d) : d,
  );

export const formatMonthYear = (d: string | null | undefined) => {
  if (!d) return "Present";
  const [y, m] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m ? `${months[Number(m) - 1] ?? ""} ${y}` : y ?? "";
};

export const credits = (n: number) => `${n} ${n === 1 ? "credit" : "credits"}`;
