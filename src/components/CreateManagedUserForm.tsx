import { useMemo, useState, type FormEvent } from "react";
import { usersApi } from "../services/api";
import type { RoleOption, UserDetail } from "../types/user";
import { errorMessage, errorText } from "../utils/errors";

interface Props {
  roles: RoleOption[];
  isAdmin: boolean;
  onCreated: (user: UserDetail) => void;
}

export default function CreateManagedUserForm({ roles, isAdmin, onCreated }: Props) {
  const allowedRoles = useMemo(
    () => roles.filter((role) => isAdmin ? role.name !== "Admin" : ["Reader", "Reviewer"].includes(role.name)),
    [isAdmin, roles],
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await usersApi.create({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        role_ids: roleIds,
      });
      setFirstName(""); setLastName(""); setEmail(""); setRoleIds([]);
      onCreated(created);
    } catch (err) {
      setError(errorText(err) ?? errorMessage(err, "Failed to create account"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="managed-account-panel">
      <h2>Create account</h2>
      <p>Create a passwordless account now. Add an email now or later, then send an invitation.</p>
      <form className="managed-account-form" onSubmit={submit}>
        <label>First name<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label>
        <label>Last name<input value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label>
        <label>Email (optional)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <fieldset>
          <legend>Roles</legend>
          {allowedRoles.map((role) => (
            <label className="role-check" key={role.id}>
              <input type="checkbox" checked={roleIds.includes(role.id)} onChange={(event) => {
                setRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id));
              }} />
              {role.name}
            </label>
          ))}
        </fieldset>
        {error && <p className="admin-user-error" role="alert">{error}</p>}
        <button className="auth-form__submit" disabled={saving} type="submit">
          {saving ? "Creating..." : "Create account"}
        </button>
      </form>
    </section>
  );
}