export type CPPost = {
    title: string;
    url: string;
    published_at: string;
    source: {
        title: string;
        domain: string;
    };
    votes?: {
        negative?: number;
        positive?: number;
        important?: number;
        saved?: number;
        liked?: number;
        disliked?: number;
    };
    currencies?: Array<{
        code: string;
    }>;
};
export declare function getNewsForToken(input: string): Promise<{
    symbol?: string;
    posts: CPPost[];
}>;
//# sourceMappingURL=news.d.ts.map