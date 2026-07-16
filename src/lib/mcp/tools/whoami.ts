import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the identity (user id, email) of the caller, verified from the OAuth token.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const identity = { user_id: ctx.getUserId(), email: ctx.getUserEmail(), client_id: ctx.getClientId() };
    return {
      content: [{ type: "text", text: JSON.stringify(identity) }],
      structuredContent: identity,
    };
  },
});