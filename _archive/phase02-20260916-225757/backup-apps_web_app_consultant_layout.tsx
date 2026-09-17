import { redirect } from "next/navigation";
import { prisma } from "@zeal/database";
import { getUserId } from "@/lib/auth";
import { WorkspaceSidebar } from "@/components/consultant/WorkspaceSidebar";

export const metadata = {
  title: "Consultant Workspace | Zeal",
  description: "Manage your practice on Zeal",
};

export default async function ConsultantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getUserId();
  if (!userId) redirect("/auth/login?redirect=/consultant/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      name: true,
      email: true,
      username: true,
      avatar: true,
      consultant: {
        select: {
          id: true,
          status: true,
          subdomain: true,
        },
      },
    },
  });

  if (!user) redirect("/auth/login");

  // If not yet a consultant, force onboarding
  if (!user.consultant) {
    redirect("/consultant/onboarding");
  }

  // If pending/rejected, show status (handled by onboarding page)
  if (user.consultant.status === "PENDING" || user.consultant.status === "REJECTED") {
    // Let the onboarding page handle this case
    if (!user.consultant.status) {
      redirect("/consultant/onboarding");
    }
  }

  return (
    <div className="flex min-h-screen bg-[#FDFBF7] dark:bg-gray-950">
      <WorkspaceSidebar
        user={{
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        }}
        consultant={{
          status: user.consultant.status,
          subdomain: user.consultant.subdomain,
        }}
      />
      <main className="flex-1 min-w-0 lg:ml-64 pb-20 lg:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

// BATCH_F3_APPLIED

export const dynamic = "force-dynamic";
