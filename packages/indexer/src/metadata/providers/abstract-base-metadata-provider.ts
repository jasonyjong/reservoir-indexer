import {
  customHandleCollection,
  customHandleToken,
  hasCustomCollectionHandler,
  hasCustomHandler,
} from "../custom";
import { CollectionMetadata, TokenMetadata, TokenMetadataBySlugResult } from "../types";
import { extendCollectionMetadata, extendMetadata, hasExtendHandler } from "../extend";
import { logger } from "@/common/logger";

export abstract class AbstractBaseMetadataProvider {
  abstract method: string;

  // Wrapper methods for internal methods, handles custom/extend logic so subclasses don't have to
  async getCollectionMetadata(contract: string, tokenId: string): Promise<CollectionMetadata> {
    // handle universal extend/custom logic here
    if (hasCustomCollectionHandler(contract)) {
      const result = await customHandleCollection({
        contract,
        tokenId: tokenId,
      });
      return result;
    }

    const collectionMetadata = await this._getCollectionMetadata(contract, tokenId);

    // handle extend logic here
    return extendCollectionMetadata(collectionMetadata, tokenId);
  }

  async getTokensMetadata(
    tokens: { contract: string; tokenId: string }[]
  ): Promise<TokenMetadata[]> {
    const customMetadata = await Promise.all(
      tokens.map(async (token) => {
        if (hasCustomHandler(token.contract)) {
          const result = await customHandleToken({
            contract: token.contract,
            _tokenId: token.tokenId,
          });

          if (token.contract === "0x2f4d2f39e3dbcd02499b1121a25e13c1b2be67ac") {
            logger.info(
              "getTokensMetadata",
              JSON.stringify({
                topic: "debugRefreshTokenMetadata",
                message: `Single token. contract=${token.contract}, tokenId=${token.tokenId}`,
                token,
                result,
              })
            );
          }

          return result;
        }
        return null;
      })
    );

    // filter out nulls
    const filteredCustomMetadata = customMetadata.filter((metadata) => metadata !== null);

    // for tokens that don't have custom metadata, get from metadata-api
    const tokensWithoutCustomMetadata = tokens.filter((token) => {
      const hasCustomMetadata = filteredCustomMetadata.find((metadata) => {
        return metadata.contract === token.contract && metadata.tokenId === token.tokenId;
      });

      if (token.contract === "0x2f4d2f39e3dbcd02499b1121a25e13c1b2be67ac") {
        logger.info(
          "getTokensMetadata",
          JSON.stringify({
            topic: "debugRefreshTokenMetadata",
            message: `Single token. contract=${token.contract}, tokenId=${token.tokenId}`,
            token,
            hasCustomMetadata,
          })
        );
      }

      return !hasCustomMetadata;
    });

    let metadataFromProvider: TokenMetadata[] = [];

    if (tokensWithoutCustomMetadata.length > 0) {
      metadataFromProvider = await this._getTokensMetadata(tokensWithoutCustomMetadata);
    }

    // merge custom metadata with metadata-api metadata
    const allMetadata: TokenMetadata[] = [...metadataFromProvider, ...filteredCustomMetadata];
    // extend metadata
    const extendedMetadata = await Promise.all(
      allMetadata.map(async (metadata) => {
        if (hasExtendHandler(metadata.contract)) {
          const result = await extendMetadata(metadata);
          return result;
        }
        return metadata;
      })
    );

    return extendedMetadata;
  }

  async getTokensMetadataBySlug(
    contract: string,
    slug: string,
    continuation: string
  ): Promise<TokenMetadataBySlugResult> {
    if (hasCustomHandler(contract) || hasExtendHandler(contract)) {
      throw new Error("Custom handler is not supported with collection slug.");
    }

    return this._getTokensMetadataBySlug(slug, continuation);
  }

  // Internal methods for subclasses
  protected abstract _getCollectionMetadata(
    contract: string,
    tokenId: string
  ): Promise<CollectionMetadata>;

  protected abstract _getTokensMetadata(
    tokens: { contract: string; tokenId: string }[]
  ): Promise<TokenMetadata[]>;

  protected abstract _getTokensMetadataBySlug(
    contract: string,
    slug: string,
    continuation?: string
  ): Promise<TokenMetadataBySlugResult>;

  // Parsers

  // eslint-disable-next-line
  protected abstract parseCollection(...args: any[]): CollectionMetadata;

  // eslint-disable-next-line
  protected abstract parseToken(...args: any[]): TokenMetadata;
}