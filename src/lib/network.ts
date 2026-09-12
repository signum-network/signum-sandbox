/**
 * The network name our mock node reports, verified against the node running
 * with `node.network = signum.net.MockNetwork`.
 */
export const MOCK_NETWORK_NAME = 'Signum-LOCAL-MOCK'

/**
 * The sandbox keeps passphrases in plain localStorage because they are worthless
 * on a mock chain. That is only true while the node actually is the mock chain,
 * so every passphrase-touching feature asks this first. An unknown network is
 * treated as foreign: the failure mode of refusing on a mock node is a confused
 * user, the failure mode of accepting on mainnet is a stolen account.
 */
export function isMockNetwork(networkName: string | undefined): boolean {
  return networkName === MOCK_NETWORK_NAME
}
