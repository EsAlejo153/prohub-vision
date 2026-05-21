import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import AlertaCuentasSinPlan from "@/components/AlertaCuentasSinPlan";

export default function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <TopBar title={title} />
      <main className="ml-[180px] pt-14">
        <div className="p-6">{children}</div>
      </main>
      <AlertaCuentasSinPlan />
    </div>
  );
}
