import { redirect } from "next/navigation";
export default function ConsultantRegisterRedirect() {
  redirect("/register?type=consultant");
}
