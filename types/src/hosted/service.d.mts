/**
 * @typedef {{ dataDir: string, token: string, noAuth?: boolean, abattyVersion?: string }} ServiceOptions
 */
/** A repository name as a folder: letters, digits, dots, dashes, underscores; anything else a dash. @param {string} name */
export function safeName(name: string): string;
/** The folder of reports as a store. @param {string} dataDir */
export function createStore(dataDir: string): {
    root: string;
    /** Store one report under its repository's folder by date; the newest wins the day. @param {any} report */
    put(report: any): {
        name: string;
        date: string;
    };
    /** Every repository with its readings, oldest first. */
    repos(): {
        name: string;
        reports: any[];
    }[];
    /** @param {string} name */
    repo(name: string): {
        name: string;
        reports: any[];
    } | null;
};
/** The score as a badge, the colour of the band the terminal uses. @param {string} label @param {number | null} score */
export function badgeSvg(label: string, score: number | null): string;
/** A report is an object with a name, a date, a numeric score and findings. @param {any} r */
export function isReport(r: any): boolean;
/**
 * The service. Returns Node's server, not yet listening, so a test can listen on port 0.
 * @param {ServiceOptions} o
 */
export function createService(o: ServiceOptions): {
    server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    store: {
        root: string;
        /** Store one report under its repository's folder by date; the newest wins the day. @param {any} report */
        put(report: any): {
            name: string;
            date: string;
        };
        /** Every repository with its readings, oldest first. */
        repos(): {
            name: string;
            reports: any[];
        }[];
        /** @param {string} name */
        repo(name: string): {
            name: string;
            reports: any[];
        } | null;
    };
};
/**
 * Post a report to a service: the CI step. Returns the service's answer.
 * @param {{ url: string, token: string, report: unknown }} o
 */
export function publishReport(o: {
    url: string;
    token: string;
    report: unknown;
}): Promise<{
    ok: boolean;
    status: number;
    body: any;
}>;
export type ServiceOptions = {
    dataDir: string;
    token: string;
    noAuth?: boolean;
    abattyVersion?: string;
};
