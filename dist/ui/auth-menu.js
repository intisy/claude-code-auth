import { ANSI, isTTY } from './ansi.js';
import { select } from './select.js';
import { confirm } from './confirm.js';
function formatRelativeTime(timestamp) {
    if (!timestamp)
        return 'never';
    const days = Math.floor((Date.now() - timestamp) / 86400000);
    if (days === 0)
        return 'today';
    if (days === 1)
        return 'yesterday';
    if (days < 7)
        return `${days}d ago`;
    if (days < 30)
        return `${Math.floor(days / 7)}w ago`;
    return new Date(timestamp).toLocaleDateString();
}
function formatDate(timestamp) {
    if (!timestamp)
        return 'unknown';
    return new Date(timestamp).toLocaleDateString();
}
function getStatusBadge(status) {
    switch (status) {
        case 'active': return `${ANSI.green}[active]${ANSI.reset}`;
        case 'rate-limited': return `${ANSI.yellow}[rate-limited]${ANSI.reset}`;
        case 'expired': return `${ANSI.red}[expired]${ANSI.reset}`;
        case 'verification-required': return `${ANSI.red}[needs verification]${ANSI.reset}`;
        default: return '';
    }
}
export async function showAuthMenu(accounts) {
    const items = [
        { label: 'Actions', value: { type: 'cancel' }, kind: 'heading' },
        { label: 'Add account', value: { type: 'add' }, color: 'cyan' },
        { label: 'Check quotas', value: { type: 'check' }, color: 'cyan' },
        { label: 'Verify one account', value: { type: 'verify' }, color: 'cyan' },
        { label: 'Verify all accounts', value: { type: 'verify-all' }, color: 'cyan' },
        { label: 'Configure models in opencode.json', value: { type: 'configure-models' }, color: 'cyan' },
        { label: 'Manage proxies', value: { type: 'proxies' }, color: 'cyan' },
        { label: '', value: { type: 'cancel' }, separator: true },
        { label: 'Accounts', value: { type: 'cancel' }, kind: 'heading' },
        ...accounts.map(account => {
            const statusBadge = getStatusBadge(account.status);
            const currentBadge = account.isCurrentAccount ? ` ${ANSI.cyan}[current]${ANSI.reset}` : '';
            const disabledBadge = account.enabled === false ? ` ${ANSI.red}[disabled]${ANSI.reset}` : '';
            const baseLabel = account.email || `Account ${account.index + 1}`;
            const numbered = `${account.index + 1}. ${baseLabel}`;
            const fullLabel = `${numbered}${currentBadge}${statusBadge ? ' ' + statusBadge : ''}${disabledBadge}`;
            return {
                label: fullLabel,
                hint: account.lastUsed ? `used ${formatRelativeTime(account.lastUsed)}` : '',
                value: { type: 'select-account', account },
            };
        }),
        { label: '', value: { type: 'cancel' }, separator: true },
        { label: 'Danger zone', value: { type: 'cancel' }, kind: 'heading' },
        { label: 'Delete all accounts', value: { type: 'delete-all' }, color: 'red' },
    ];
    while (true) {
        const result = await select(items, {
            message: 'Google accounts (Antigravity)',
            subtitle: 'Select an action or account',
            clearScreen: true,
        });
        if (!result)
            return { type: 'cancel' };
        if (result.type === 'delete-all') {
            const confirmed = await confirm('Delete ALL accounts? This cannot be undone.');
            if (!confirmed)
                continue;
        }
        return result;
    }
}
export async function showAccountDetails(account) {
    const label = account.email || `Account ${account.index + 1}`;
    const badge = getStatusBadge(account.status);
    const disabledBadge = account.enabled === false ? ` ${ANSI.red}[disabled]${ANSI.reset}` : '';
    const header = `${label}${badge ? ' ' + badge : ''}${disabledBadge}`;
    const subtitleParts = [
        `Added: ${formatDate(account.addedAt)}`,
        `Last used: ${formatRelativeTime(account.lastUsed)}`,
    ];
    while (true) {
        const result = await select([
            { label: 'Back', value: 'back' },
            { label: 'Verify account access', value: 'verify', color: 'cyan' },
            { label: account.enabled === false ? 'Enable account' : 'Disable account', value: 'toggle', color: account.enabled === false ? 'green' : 'yellow' },
            { label: 'Manage proxies', value: 'proxies', color: 'cyan' },
            { label: 'Refresh token', value: 'refresh', color: 'cyan' },
            { label: 'Delete this account', value: 'delete', color: 'red' },
        ], {
            message: header,
            subtitle: subtitleParts.join(' | '),
            clearScreen: true,
        });
        if (result === 'delete') {
            const confirmed = await confirm(`Delete ${label}?`);
            if (!confirmed)
                continue;
        }
        if (result === 'refresh') {
            const confirmed = await confirm(`Re-authenticate ${label}?`);
            if (!confirmed)
                continue;
        }
        return result ?? 'cancel';
    }
}
export { isTTY };
async function promptProxyMenuFallback(accountLabel, currentProxies) {
    const readline = await import('node:readline/promises');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        console.log(`\nManage Proxies: ${accountLabel}`);
        if (currentProxies.length > 0) {
            console.log(`Current proxies:`);
            currentProxies.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
        }
        else {
            console.log(`No proxies configured.`);
        }
        while (true) {
            const options = currentProxies.length > 0 ? '(a)dd, (r)emove <num>, (c)lear, (b)ack' : '(a)dd, (b)ack';
            const answer = await rl.question(`Choose action ${options}: `);
            const normalized = answer.trim().toLowerCase();
            if (normalized === 'a' || normalized === 'add') {
                return { action: 'add' };
            }
            if (normalized === 'c' || normalized === 'clear') {
                return { action: 'clear' };
            }
            if (normalized === 'b' || normalized === 'back') {
                return { action: 'back' };
            }
            if (normalized.startsWith('r') || normalized.startsWith('remove')) {
                const parts = normalized.split(/\s+/);
                const idx = parseInt(parts[1] ?? '', 10) - 1;
                if (!isNaN(idx) && idx >= 0 && idx < currentProxies.length) {
                    return { action: 'remove', index: idx };
                }
                console.log(`Invalid proxy number. Use 'r 1' to remove the first proxy.`);
            }
        }
    }
    finally {
        rl.close();
    }
}
export async function showProxyMenu(accountLabel, currentProxies) {
    if (!isTTY()) {
        return promptProxyMenuFallback(accountLabel, currentProxies);
    }
    while (true) {
        const items = [
            { label: 'Back', value: { action: 'back' } },
            { label: 'Add proxy URL', value: { action: 'add' }, color: 'cyan' },
        ];
        if (currentProxies.length > 0) {
            items.push({ label: '', value: { action: 'back' }, separator: true });
            items.push({ label: 'Current proxies', value: { action: 'back' }, kind: 'heading' });
            currentProxies.forEach((proxy, idx) => {
                items.push({
                    label: `Remove proxy ${idx + 1}`,
                    hint: proxy,
                    value: { action: 'remove', index: idx },
                    color: 'yellow'
                });
            });
            items.push({ label: '', value: { action: 'back' }, separator: true });
            items.push({ label: 'Clear all proxies', value: { action: 'clear' }, color: 'red' });
        }
        const result = await select(items, {
            message: `Manage Proxies: ${accountLabel}`,
            subtitle: `${currentProxies.length} proxies configured`,
            clearScreen: true,
        });
        if (!result)
            return { action: 'back' };
        if (result.action === 'clear') {
            const confirmed = await confirm('Clear ALL proxies for this account?');
            if (!confirmed)
                continue;
        }
        return result;
    }
}
export async function promptProxyUrl() {
    const readline = await import('node:readline/promises');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await rl.question(`\n${ANSI.cyan}?${ANSI.reset} Enter proxy URL (e.g. http://user:pass@host:port/): `);
        return answer.trim() || undefined;
    }
    finally {
        rl.close();
    }
}
