import { isTTY } from './ansi.js';
export type AccountStatus = 'active' | 'rate-limited' | 'expired' | 'verification-required' | 'unknown';
export interface AccountInfo {
    email?: string;
    index: number;
    addedAt?: number;
    lastUsed?: number;
    status?: AccountStatus;
    isCurrentAccount?: boolean;
    enabled?: boolean;
}
export type AuthMenuAction = {
    type: 'add';
} | {
    type: 'select-account';
    account: AccountInfo;
} | {
    type: 'delete-all';
} | {
    type: 'check';
} | {
    type: 'verify';
} | {
    type: 'verify-all';
} | {
    type: 'configure-models';
} | {
    type: 'proxies';
} | {
    type: 'cancel';
};
export type AccountAction = 'back' | 'delete' | 'refresh' | 'toggle' | 'verify' | 'proxies' | 'cancel';
export declare function showAuthMenu(accounts: AccountInfo[]): Promise<AuthMenuAction>;
export declare function showAccountDetails(account: AccountInfo): Promise<AccountAction>;
export { isTTY };
export type ProxyMenuAction = {
    action: 'add';
} | {
    action: 'remove';
    index: number;
} | {
    action: 'clear';
} | {
    action: 'back';
};
export declare function showProxyMenu(accountLabel: string, currentProxies: string[]): Promise<ProxyMenuAction>;
export declare function promptProxyUrl(): Promise<string | undefined>;
