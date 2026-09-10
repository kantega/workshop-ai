import { logInAs } from "@/lib/session/actions";
import { TEST_PERSONS } from "@/lib/session/test-persons";
import { CREDENTIAL_BY_ID } from "@/lib/catalog/credentials";

export default function LogIn() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Logg inn</h1>
        <p className="text-muted">
          I en ekte løsning er dette ID-porten. Her velger du en testperson. Hver har sin egen lommebok.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {TEST_PERSONS.map((person) => (
          <form key={person.id} action={logInAs} className="card flex flex-col gap-3">
            <input type="hidden" name="personId" value={person.id} />
            <div>
              <div className="font-semibold">{person.name}</div>
              <div className="text-sm text-muted">{person.tagline}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {person.wallet.map((entry) => (
                <span key={entry.queryId} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">
                  {CREDENTIAL_BY_ID[entry.queryId].label}
                </span>
              ))}
            </div>
            <button type="submit" className="btn-primary mt-auto">
              Logg inn som {person.name.split(" ")[0]}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
