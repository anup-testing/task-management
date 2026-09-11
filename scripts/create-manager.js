/**
 * Create the first manager on a fresh, unseeded database.
 *   npm run create-manager -- "Roshani Shinde" rshinde@lghomecomfort.ca
 */
import { upsertEmployee, setPassword, getEmployeeByEmail, listEmployees } from "../src/db.js";
import { hashPassword, randomPassword } from "../src/auth.js";

const [name, email] = process.argv.slice(2);
if (!name || !email) {
  console.error('Usage: npm run create-manager -- "Full Name" email@company.com');
  process.exit(1);
}
if (getEmployeeByEmail(email)) { console.error("That email is already in use."); process.exit(1); }

const id = "emp-" + email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
upsertEmployee({ id, name, email, initials, role: "manager", title: "Manager",
                 departmentId: "mkt", teamId: "seo", capacityHours: 40, active: true });
const password = randomPassword();
setPassword(id, hashPassword(password), 1);

console.log(`
  Manager created.

    Email:    ${email}
    Password: ${password}

  You'll be asked to change it after signing in.
  ${listEmployees().length} people in the database.
`);
