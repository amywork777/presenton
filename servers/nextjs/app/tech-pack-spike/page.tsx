import { techPackExample } from "./techPackModel";
import { VizcomTechPackBridge } from "./VizcomTechPackBridge";

export default function TechPackSpikePage() {
  return <VizcomTechPackBridge fallback={techPackExample} />;
}
