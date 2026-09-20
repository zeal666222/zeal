import {redirect} from "next/navigation";
export default function ConsultantLoginRedirect() {
  redirect("/login?type=consultant");
}
