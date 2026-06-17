import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline/promises";
import { showAuthMenu, type AccountInfo, type AuthMenuAction } from "./ui/auth-menu.js";

const CONFIG_DIR = path.join(os.homedir(), ".config", "intisy", "claude-auth");
const ACCOUNTS_FILE = path.join(CONFIG_DIR, "accounts.json");

interface Account {
  email: string;
  sessionKey: string;
  isActive: boolean;
  addedAt: number;
}

function loadAccounts(): Account[] {
  if (fs.existsSync(ACCOUNTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function saveAccounts(accounts: Account[]) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

const claudeAuthPlugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  return {
    auth: {
      provider: "claude-pro",
      methods: [
        {
          type: "api",
          label: "Session Key",
        }
      ]
    },
    config: async () => {
      let accounts = loadAccounts();

      while (true) {
        // Map our internal Account to the UI's AccountInfo format
        const accountInfos: AccountInfo[] = accounts.map((acc, index) => ({
          email: acc.email,
          index,
          addedAt: acc.addedAt,
          status: 'active',
          isCurrentAccount: acc.isActive,
          enabled: acc.isActive
        }));

        const action = await showAuthMenu(accountInfos);

        if (action.type === 'cancel') {
          break;
        }

        if (action.type === 'add') {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          console.log('\n--- Add Claude Pro Account ---');
          const email = await rl.question('Enter email for this account: ');
          const sessionKey = await rl.question('Enter sessionKey cookie value: ');
          rl.close();

          accounts.forEach(a => a.isActive = false);
          accounts.push({ email, sessionKey, isActive: true, addedAt: Date.now() });
          saveAccounts(accounts);
          console.log('Account added and set as active.');
        }
        else if (action.type === 'delete-all') {
          accounts = [];
          saveAccounts(accounts);
          console.log('All accounts deleted.');
        }
        else if (action.type === 'select-account') {
           const idx = action.account.index;
           if (idx >= 0 && idx < accounts.length) {
             accounts.forEach(a => a.isActive = false);
             accounts[idx].isActive = true;
             saveAccounts(accounts);
             console.log(`Account ${accounts[idx].email} is now active.`);
           }
        }
      }
    }
  };
};

export default claudeAuthPlugin;
