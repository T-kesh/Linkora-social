import {
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  rpc as StellarRpc,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
  Keypair,
} from "@stellar/stellar-sdk";

import { mapError } from "./errors";

// ── Types ─────────────────────────────────────────────────────────────────────

export type { StellarRpc };
export { Address };

export type Signer =
  | { signTransaction(tx: string, opts?: { networkPassphrase?: string }): Promise<string> | string }
  | Keypair
  | ((tx: Transaction) => Promise<Transaction> | Transaction);

export interface Post {
  id: bigint;
  author: string;
  content: string;
  tip_total: bigint;
  timestamp: bigint;
  like_count: bigint;
}

export interface Profile {
  address: string;
  username: string;
  creator_token: string;
}

export interface Pool {
  token: string;
  balance: bigint;
  admins: string[];
  threshold: number;
}

export interface LinkoraClientConfig {
  /** Stellar RPC endpoint URL */
  rpcUrl: string;
  /** Deployed contract ID (C...) */
  contractId: string;
  /** Network passphrase, e.g. "Test SDF Network ; September 2015" */
  networkPassphrase: string;
}

export interface WriteTxResult {
  txHash: string;
  ledger: number;
}

export interface CreatePostResult extends WriteTxResult {
  postId: bigint;
}

// ── Client ────────────────────────────────────────────────────────────────────

export class LinkoraClient {
  private readonly contract: Contract;
  private readonly server: StellarRpc.Server;
  private readonly networkPassphrase: string;

  constructor(config: LinkoraClientConfig) {
    this.contract = new Contract(config.contractId);
    this.server = new StellarRpc.Server(config.rpcUrl);
    this.networkPassphrase = config.networkPassphrase;
  }

  // ── Read-Only Methods ────────────────────────────────────────────────────────

  /**
   * Fetch a user profile by address.
   * @param user Stellar address of the user.
   */
  async getProfile(user: string): Promise<Profile | null> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_profile", [Address.fromString(user).toScVal()])
      );
      return parseOptional<Profile>(result);
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Fetch total count of created user profiles.
   */
  async getProfileCount(): Promise<bigint> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_profile_count", [])
      );
      return scValToNative(extractReturnValue(result)) as bigint;
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Get paginated following list for a user.
   */
  async getFollowing(
    user: string,
    offset: number,
    limit: number
  ): Promise<string[]> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_following", [
          Address.fromString(user).toScVal(),
          nativeToScVal(offset, { type: "u32" }),
          nativeToScVal(limit, { type: "u32" }),
        ])
      );
      return scValToNative(extractReturnValue(result)) as string[];
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Get paginated followers list for a user.
   */
  async getFollowers(
    user: string,
    offset: number,
    limit: number
  ): Promise<string[]> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_followers", [
          Address.fromString(user).toScVal(),
          nativeToScVal(offset, { type: "u32" }),
          nativeToScVal(limit, { type: "u32" }),
        ])
      );
      return scValToNative(extractReturnValue(result)) as string[];
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Checks if blocker blocked another user.
   */
  async isBlocked(blocker: string, blocked: string): Promise<boolean> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("is_blocked", [
          Address.fromString(blocker).toScVal(),
          Address.fromString(blocked).toScVal(),
        ])
      );
      return scValToNative(extractReturnValue(result)) as boolean;
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Fetch a single post by ID.
   */
  async getPost(id: bigint): Promise<Post | null> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_post", [nativeToScVal(id, { type: "u64" })])
      );
      return parseOptional<Post>(result);
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Fetch total post count.
   */
  async getPostCount(): Promise<bigint> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_post_count", [])
      );
      return scValToNative(extractReturnValue(result)) as bigint;
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Get paginated list of post IDs for an author.
   */
  async getPostsByAuthor(
    author: string,
    offset: number,
    limit: number
  ): Promise<bigint[]> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_posts_by_author", [
          Address.fromString(author).toScVal(),
          nativeToScVal(offset, { type: "u32" }),
          nativeToScVal(limit, { type: "u32" }),
        ])
      );
      return scValToNative(extractReturnValue(result)) as bigint[];
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Get total likes for a post.
   */
  async getLikeCount(postId: bigint): Promise<bigint> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_like_count", [nativeToScVal(postId, { type: "u64" })])
      );
      return scValToNative(extractReturnValue(result)) as bigint;
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Check if user liked a post.
   */
  async hasLiked(user: string, postId: bigint): Promise<boolean> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("has_liked", [
          Address.fromString(user).toScVal(),
          nativeToScVal(postId, { type: "u64" }),
        ])
      );
      return scValToNative(extractReturnValue(result)) as boolean;
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Fetch a community pool by ID.
   */
  async getPool(poolId: string): Promise<Pool | null> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_pool", [
          nativeToScVal(poolId, { type: "symbol" }),
        ])
      );
      return parseOptional<Pool>(result);
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Get current protocol fee basis points.
   */
  async getFeeBps(): Promise<number> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_fee_bps", [])
      );
      return scValToNative(extractReturnValue(result)) as number;
    } catch (err) {
      throw mapError(err);
    }
  }

  /**
   * Get treasury address.
   */
  async getTreasury(): Promise<string | null> {
    try {
      const result = await this.server.simulateTransaction(
        this.buildSimulateTx("get_treasury", [])
      );
      return parseOptional<string>(result);
    } catch (err) {
      throw mapError(err);
    }
  }

  // ── Contract Write Methods ───────────────────────────────────────────────────

  /**
   * Set or update profile details on-chain.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.user Target user address.
   * @param args.username Chosen profile name.
   * @param args.creatorToken Address of the user's creator token.
   */
  async setProfile(
    signer: Signer,
    sourceAddress: string,
    args: { user: string; username: string; creatorToken: string }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.user).toScVal(),
      nativeToScVal(args.username, { type: "string" }),
      Address.fromString(args.creatorToken).toScVal(),
    ];
    const tx = await this.buildAndPrepare("set_profile", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Follow a user to build the on-chain social graph.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.follower User performing the follow.
   * @param args.followee Target user to follow.
   */
  async follow(
    signer: Signer,
    sourceAddress: string,
    args: { follower: string; followee: string }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.follower).toScVal(),
      Address.fromString(args.followee).toScVal(),
    ];
    const tx = await this.buildAndPrepare("follow", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Unfollow a user.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.follower User performing the unfollow.
   * @param args.followee Target user to unfollow.
   */
  async unfollow(
    signer: Signer,
    sourceAddress: string,
    args: { follower: string; followee: string }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.follower).toScVal(),
      Address.fromString(args.followee).toScVal(),
    ];
    const tx = await this.buildAndPrepare("unfollow", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Block a user.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.blocker Blocker address.
   * @param args.blocked Target address to block.
   */
  async blockUser(
    signer: Signer,
    sourceAddress: string,
    args: { blocker: string; blocked: string }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.blocker).toScVal(),
      Address.fromString(args.blocked).toScVal(),
    ];
    const tx = await this.buildAndPrepare("block_user", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Unblock a user.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.blocker Blocker address.
   * @param args.blocked Target address to unblock.
   */
  async unblockUser(
    signer: Signer,
    sourceAddress: string,
    args: { blocker: string; blocked: string }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.blocker).toScVal(),
      Address.fromString(args.blocked).toScVal(),
    ];
    const tx = await this.buildAndPrepare("unblock_user", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Create a new social post on-chain.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.author Account creating the post.
   * @param args.content Post markdown content.
   */
  async createPost(
    signer: Signer,
    sourceAddress: string,
    args: { author: string; content: string }
  ): Promise<CreatePostResult> {
    const params = [
      Address.fromString(args.author).toScVal(),
      nativeToScVal(args.content, { type: "string" }),
    ];
    const tx = await this.buildAndPrepare("create_post", params, sourceAddress);
    const execution = await this.signAndSubmit(tx, signer);

    let postId: bigint = 0n;
    if (execution.returnValue) {
      postId = scValToNative(execution.returnValue) as bigint;
    }

    return {
      ...execution,
      postId,
    };
  }

  /**
   * Delete an existing post. Only the author can delete.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.author Author address.
   * @param args.postId Target post ID.
   */
  async deletePost(
    signer: Signer,
    sourceAddress: string,
    args: { author: string; postId: bigint }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.author).toScVal(),
      nativeToScVal(args.postId, { type: "u64" }),
    ];
    const tx = await this.buildAndPrepare("delete_post", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Like a post.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.user User liking the post.
   * @param args.postId Target post ID.
   */
  async likePost(
    signer: Signer,
    sourceAddress: string,
    args: { user: string; postId: bigint }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.user).toScVal(),
      nativeToScVal(args.postId, { type: "u64" }),
    ];
    const tx = await this.buildAndPrepare("like_post", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Tip a post.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.tipper Account tipping.
   * @param args.postId Target post ID.
   * @param args.token Address of the tip token.
   * @param args.amount Amount to tip (in base units).
   */
  async tip(
    signer: Signer,
    sourceAddress: string,
    args: { tipper: string; postId: bigint; token: string; amount: bigint }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.tipper).toScVal(),
      nativeToScVal(args.postId, { type: "u64" }),
      Address.fromString(args.token).toScVal(),
      nativeToScVal(args.amount, { type: "i128" }),
    ];
    const tx = await this.buildAndPrepare("tip", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Create a new community treasury pool.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.admin Main administrator account creating the pool.
   * @param args.poolId String name/symbol identifier of the pool.
   * @param args.token Token address accepted by the pool.
   * @param args.initialAdmins Initial admin signers set.
   * @param args.threshold Number of admin signatures required for withdrawals.
   */
  async createPool(
    signer: Signer,
    sourceAddress: string,
    args: {
      admin: string;
      poolId: string;
      token: string;
      initialAdmins: string[];
      threshold: number;
    }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.admin).toScVal(),
      nativeToScVal(args.poolId, { type: "symbol" }),
      Address.fromString(args.token).toScVal(),
      nativeToScVal(
        args.initialAdmins.map((addr) => Address.fromString(addr)),
        { type: "Vec" }
      ),
      nativeToScVal(args.threshold, { type: "u32" }),
    ];
    const tx = await this.buildAndPrepare("create_pool", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Deposit tokens into a community pool treasury.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.depositor Payer address depositing.
   * @param args.poolId Pool identifier.
   * @param args.token Token address.
   * @param args.amount Amount in base units.
   */
  async poolDeposit(
    signer: Signer,
    sourceAddress: string,
    args: { depositor: string; poolId: string; token: string; amount: bigint }
  ): Promise<WriteTxResult> {
    const params = [
      Address.fromString(args.depositor).toScVal(),
      nativeToScVal(args.poolId, { type: "symbol" }),
      Address.fromString(args.token).toScVal(),
      nativeToScVal(args.amount, { type: "i128" }),
    ];
    const tx = await this.buildAndPrepare("pool_deposit", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  /**
   * Withdraw funds from a pool. Requires M-of-N signatures.
   *
   * @param signer Authorized transaction signer.
   * @param sourceAddress Account address submitting the transaction.
   * @param args.signers Array of administrative addresses approving.
   * @param args.poolId Pool identifier.
   * @param args.amount Amount to withdraw.
   * @param args.recipient Address receiving the payout.
   */
  async poolWithdraw(
    signer: Signer,
    sourceAddress: string,
    args: {
      signers: string[];
      poolId: string;
      amount: bigint;
      recipient: string;
    }
  ): Promise<WriteTxResult> {
    const params = [
      nativeToScVal(
        args.signers.map((addr) => Address.fromString(addr)),
        { type: "Vec" }
      ),
      nativeToScVal(args.poolId, { type: "symbol" }),
      nativeToScVal(args.amount, { type: "i128" }),
      Address.fromString(args.recipient).toScVal(),
    ];
    const tx = await this.buildAndPrepare("pool_withdraw", params, sourceAddress);
    return this.signAndSubmit(tx, signer);
  }

  // ── Internal Helpers ─────────────────────────────────────────────────────────

  private buildSimulateTx(method: string, args: xdr.ScVal[]) {
    const op = this.contract.call(method, ...args);
    const source = new (require("@stellar/stellar-sdk").Account)(
      "GD6N4P3IZQK6QTZCMAHN6QXCRP75735ECTCL23JKBYB2OML3SJ3EOCHS",
      "0"
    );
    return new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();
  }

  private async buildAndPrepare(
    method: string,
    args: xdr.ScVal[],
    sourceAddress: string
  ): Promise<Transaction> {
    try {
      const sourceAccount = await this.server.getAccount(sourceAddress);
      const op = this.contract.call(method, ...args);

      let tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      tx = await this.server.prepareTransaction(tx);
      return tx;
    } catch (err) {
      throw mapError(err);
    }
  }

  private async signAndSubmit(
    tx: Transaction,
    signer: Signer
  ): Promise<{ txHash: string; ledger: number; returnValue?: xdr.ScVal }> {
    let signedTx: Transaction;

    try {
      if (typeof signer === "function") {
        signedTx = await signer(tx);
      } else if (typeof (signer as any).signTransaction === "function") {
        const signedXdr = await (signer as any).signTransaction(tx.toXDR(), {
          networkPassphrase: this.networkPassphrase,
        });
        signedTx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase) as Transaction;
      } else if (typeof (signer as any).sign === "function") {
        tx.sign(signer as any);
        signedTx = tx;
      } else {
        throw new Error("Invalid signer format. Signer must be a function, a Keypair, or support signTransaction.");
      }

      const response = await this.server.sendTransaction(signedTx);
      if (response.status === "ERROR") {
        throw new Error(`Transaction submission error: ${JSON.stringify((response as any).errorResultXdr || (response as any).errorResult)}`);
      }

      // Poll for transaction outcome
      const txHash = response.hash;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        const txStatus = await this.server.getTransaction(txHash);
        if (txStatus.status === "SUCCESS") {
          return {
            txHash,
            ledger: txStatus.ledger,
            returnValue: txStatus.returnValue,
          };
        } else if (txStatus.status === "FAILED") {
          throw new Error(`Transaction failed in ledger: ${txStatus.resultXdr}`);
        }
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      throw new Error("Transaction execution timed out after 30 seconds.");
    } catch (err) {
      throw mapError(err);
    }
  }
}

// ── Utility Helpers ──────────────────────────────────────────────────────────

function extractReturnValue(
  result: StellarRpc.Api.SimulateTransactionResponse
): xdr.ScVal {
  if (StellarRpc.Api.isSimulationError(result)) {
    throw new Error(`Simulation error: ${result.error}`);
  }
  const success = result as StellarRpc.Api.SimulateTransactionSuccessResponse;
  if (!success.result) {
    throw new Error("No return value from simulation");
  }
  return success.result.retval;
}

function parseOptional<T>(
  result: StellarRpc.Api.SimulateTransactionResponse
): T | null {
  const val = extractReturnValue(result);
  const native = scValToNative(val);
  if (native === undefined || native === null) return null;
  return native as T;
}
