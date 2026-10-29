import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ledger } from '@/lib/ledger'
import { slotMatches, slotOfValue, type KnownId } from '@/lib/contractData'
import { toAccountId, toAddress } from '@/lib/recipient'
import { Identicon } from '@/components/Identicon'
import { ConsoleButton, RowButton } from '@/components/console/ConsoleButton'
import { Term } from '@/components/console/Term'
import { useValueFlash } from '@/motion'
import { InspectLink } from './InspectLink'
import { WatchLink } from './WatchLink'

/** How many key1 values the form offers again. Kept in state only. */
const RECENT_KEYS = 5

const field = 'border bg-transparent px-2 py-1 text-[13px] text-[var(--text)]'
const border = { borderColor: 'var(--border2)' }

type Lookup = { key1: string; key2: string | null }

/** A number, and the name behind it when it is an id the page knows. */
function KnownValue({
  value,
  known,
  addressPrefix,
}: {
  value: string
  known: Map<string, KnownId>
  addressPrefix: string
}) {
  const account = known.get(value)
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono">{value}</span>
      {account && (
        <>
          <Identicon value={toAddress(account.id, addressPrefix)} size={14} />
          {account.name}
          {account.contract ? (
            <InspectLink contractId={account.id} />
          ) : (
            <WatchLink address={toAddress(account.id, addressPrefix)} />
          )}
        </>
      )}
    </span>
  )
}

/** One entry, flashing when the contract writes a different value to it. */
function MapRow({
  entry,
  known,
  addressPrefix,
  hit,
}: {
  entry: { key2: string; value: string }
  known: Map<string, KnownId>
  addressPrefix: string
  hit: boolean
}) {
  const flash = useValueFlash<HTMLTableRowElement>(entry.value)
  return (
    <tr
      ref={flash}
      className="border-b"
      style={{ ...border, boxShadow: hit ? 'inset 2px 0 0 var(--blue3)' : undefined }}
    >
      <td className="px-2 py-[2px]">
        <KnownValue value={entry.key2} known={known} addressPrefix={addressPrefix} />
      </td>
      <td className="px-2 py-[2px]">
        <KnownValue value={entry.value} known={known} addressPrefix={addressPrefix} />
      </td>
    </tr>
  )
}

/**
 * A contract's maps, looked up by key1 and optionally key2.
 *
 * Keys are folded through toAccountId, so an address works wherever its id
 * does: contracts key their maps by account more often than by anything else.
 */
export function ContractMaps({
  contractId,
  known,
  addressPrefix,
  query,
  onHits,
}: {
  contractId: string
  known: Map<string, KnownId>
  addressPrefix: string
  /** The page's search; entries it finds by key2 or value are marked. */
  query: string
  /** How many of the loaded entries the search finds, for the tab's count. */
  onHits: (hits: number) => void
}) {
  const { t } = useTranslation()
  const [key1, setKey1] = useState('')
  const [key2, setKey2] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [submitted, setSubmitted] = useState<Lookup | null>(null)
  const [recent, setRecent] = useState<string[]>([])

  const submit = (rawKey1: string, rawKey2: string) => {
    let lookup: Lookup
    try {
      lookup = {
        key1: toAccountId(rawKey1),
        key2: rawKey2.trim() ? toAccountId(rawKey2) : null,
      }
    } catch {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setSubmitted(lookup)
    setRecent((previous) =>
      [lookup.key1, ...previous.filter((k) => k !== lookup.key1)].slice(0, RECENT_KEYS),
    )
  }

  const result = useQuery({
    queryKey: ['contractMap', contractId, submitted?.key1, submitted?.key2 ?? null],
    queryFn: () =>
      submitted!.key2 === null
        ? ledger.contract
            .getContractMapValuesByFirstKey({ contractId, key1: submitted!.key1 })
            .then((r) => r.keyValues.map(({ key2, value }) => ({ key2, value })))
        : ledger.contract
            .getSingleContractMapValue({
              contractId,
              key1: submitted!.key1,
              key2: submitted!.key2,
            })
            .then((r) => [{ key2: submitted!.key2!, value: r.value }]),
    enabled: submitted !== null,
    retry: false,
  })

  // Only what the node has answered can be searched: maps cannot be listed
  // without a key1. Entries go through the slots' own search, as slots.
  const hits = useMemo(() => {
    const found = new Set<string>()
    for (const entry of result.data ?? []) {
      const matches = (value: string) => {
        try {
          return slotMatches(slotOfValue(value), query, { addressPrefix, known })
        } catch {
          return false
        }
      }
      if (matches(entry.key2) || matches(entry.value)) found.add(entry.key2)
    }
    return found
  }, [result.data, query, addressPrefix, known])

  useEffect(() => {
    onHits(submitted ? hits.size : 0)
  }, [hits, submitted, onHits])

  return (
    <div className="mt-4">
      <div className="mb-1 text-[11px] uppercase tracking-[2px] text-[var(--blue3)]">
        <Term id="contractMap" />
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit(key1, key2)
        }}
      >
        <input
          className={field}
          style={border}
          value={key1}
          onChange={(event) => setKey1(event.target.value)}
          placeholder={t('inspector.maps.key1')}
        />
        <input
          className={field}
          style={border}
          value={key2}
          onChange={(event) => setKey2(event.target.value)}
          placeholder={t('inspector.maps.key2')}
        />
        {/* A hidden submit so Enter in either field looks up, as the button does. */}
        <button type="submit" hidden />
        <ConsoleButton onClick={() => submit(key1, key2)}>{t('inspector.maps.load')}</ConsoleButton>
      </form>
      {invalid && (
        <p className="mt-1 text-[12px] text-[var(--mag)]">{t('inspector.maps.invalidKey')}</p>
      )}
      {recent.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-[var(--muted)]">{t('inspector.maps.recent')}</span>
          {recent.map((key) => (
            <RowButton
              key={key}
              className="font-mono text-[var(--blue3)] underline"
              onClick={() => {
                setKey1(key)
                setKey2('')
                submit(key, '')
              }}
            >
              {known.get(key)?.name ?? key}
            </RowButton>
          ))}
        </div>
      )}

      {submitted && result.data && (
        <div className="mt-2 overflow-x-auto">
          {result.data.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">{t('inspector.maps.none')}</p>
          ) : (
            <table className="w-full whitespace-nowrap text-[12px]">
              <thead>
                <tr className="border-b" style={border}>
                  {[t('inspector.maps.key2Column'), t('inspector.maps.value')].map((head) => (
                    <th
                      key={head}
                      className="px-2 py-1 text-left text-[11px] font-normal uppercase tracking-[1px] text-[var(--muted)]"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.map((entry) => (
                  <MapRow
                    key={entry.key2}
                    hit={hits.has(entry.key2)}
                    entry={entry}
                    known={known}
                    addressPrefix={addressPrefix}
                  />
                ))}
              </tbody>
            </table>
          )}
          {submitted.key2 !== null && (
            <p className="mt-1 text-[12px] text-[var(--muted)]">{t('inspector.maps.zeroNote')}</p>
          )}
        </div>
      )}
    </div>
  )
}
