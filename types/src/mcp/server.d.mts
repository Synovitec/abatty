/**
 * @typedef {{ name: string, description: string, inputSchema: object, run: (args: Record<string, any>) => Promise<unknown> }} Tool
 * @typedef {{ jsonrpc: "2.0", id?: number | string | null, method?: string, params?: any, result?: any, error?: { code: number, message: string } }} Message
 */
/** The tools of one repository. @param {string} repoDir @returns {Tool[]} */
export function tools(repoDir: string): Tool[];
/**
 * A pure message handler for one repository: a request in, a response out (null for a
 * notification). Errors are JSON-RPC errors or tool results with isError, never a crash.
 * @param {string} repoDir
 */
export function createHandler(repoDir: string): (m: Message) => Promise<Message | null>;
/**
 * Serve over stdio until stdin closes. Nothing but JSON-RPC goes to stdout; the log goes to
 * stderr. @param {string} repoDir
 */
export function serve(repoDir: string): void;
/** The protocol version this server speaks, answered at initialisation so a client can refuse a mismatch. */
export const PROTOCOL_VERSION: "2025-06-18";
export type Tool = {
    name: string;
    description: string;
    inputSchema: object;
    run: (args: Record<string, any>) => Promise<unknown>;
};
export type Message = {
    jsonrpc: "2.0";
    id?: number | string | null;
    method?: string;
    params?: any;
    result?: any;
    error?: {
        code: number;
        message: string;
    };
};
