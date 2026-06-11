import ProfileNav from "@/components/profile/ProfileNav";
import ProfileHeader from "@/components/profile/ProfileHeader";
import Services from "@/components/profile/Services";
import Results from "@/components/profile/Results";
import Products from "@/components/profile/Products";
import ProfileTestimonials from "@/components/profile/ProfileTestimonials";
import Faq from "@/components/profile/Faq";
import ProfileCta from "@/components/profile/ProfileCta";
import ProfileFooter from "@/components/profile/ProfileFooter";

export default function DemoPage() {
  return (
    <>
      <ProfileNav />
      <ProfileHeader />
      <Services />
      <Results />
      <Products />
      <ProfileTestimonials />
      <Faq />
      <ProfileCta />
      <ProfileFooter />
    </>
  );
}