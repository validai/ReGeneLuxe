import SettingsPage from "../../../src/screens/SettingsPage";
import { getDbHealth, initDb } from "../../../server/db/index.js";
import { toClientDbHealth } from "../../../server/db/healthPayload.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  let initialDbHealth;
  try {
    await initDb();
    initialDbHealth = toClientDbHealth(await getDbHealth());
  } catch (error) {
    initialDbHealth = toClientDbHealth(null, {
      fetchFailed: true,
      error: error instanceof Error ? error.message : "Database health unavailable",
    });
  }
  return <SettingsPage initialDbHealth={initialDbHealth} />;
}
