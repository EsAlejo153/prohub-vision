import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMesesTool from "./tools/list_meses";
import getEsfTool from "./tools/get_esf";
import getEriTool from "./tools/get_eri";

// The OAuth issuer is the external Supabase project that owns user
// accounts for this app. It MUST be the direct <ref>.supabase.co host
// so it matches the issuer published by the discovery document.
const EXTERNAL_SUPABASE_PROJECT_REF = "srbyogadhamglfatjlbx";

export default defineMcp({
  name: "iqlick-mcp",
  title: "iQlick Control Financiero",
  version: "0.1.0",
  instructions:
    "Tools to read Prohub/iQlick financial data (Estado de Situación Financiera, Estado de Resultados Integral). Call list_meses first to find available año_mes_num, then get_esf or get_eri with a compania ('IQLICK', 'PROHUB S.A.S.', or 'Todas') and the año_mes_num as YYYYMM.",
  auth: auth.oauth.issuer({
    issuer: `https://${EXTERNAL_SUPABASE_PROJECT_REF}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listMesesTool, getEsfTool, getEriTool],
});