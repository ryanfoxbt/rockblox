import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "rockblox" });

export interface SongImportRequestedData {
  importId: string;
}
