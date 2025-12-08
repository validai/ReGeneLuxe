// regeneluxe-web/src/pages/NewCampaign.jsx
import SiteHeader from "../components/SiteHeader";
import BluePrintForm from "../sections/BluePrintForm";

export default function NewCampaign() {
  return (
    <div className="min-h-screen bg-page text-rl_ink">
      <SiteHeader />
      <main className="mx-auto max-w-container px-6 pb-16 pt-12">
        <h1 className="sr-only">Start a new campaign</h1>
        <BluePrintForm />
      </main>
    </div>
  );
}
