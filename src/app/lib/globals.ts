// src/app/lib/globals.ts

import { PastelGlobals } from '@/app/types';

const pastelGlobals: PastelGlobals = {
  MY_LOCAL_PASTELID: null,
  MY_PASTELID_PASSPHRASE: null,
  MAX_CHARACTERS_TO_DISPLAY_IN_ERROR_MESSAGE: 1000,

  setPastelIdAndPassphrase(pastelId: string, passphrase: string): void {
    this.MY_LOCAL_PASTELID = pastelId;
    this.MY_PASTELID_PASSPHRASE = passphrase;
  },

  getPastelIdAndPassphrase(): { pastelID: string | null; passphrase: string | null } {
    return { pastelID: this.MY_LOCAL_PASTELID, passphrase: this.MY_PASTELID_PASSPHRASE };
  },

  getPastelId(): string | null {
    return this.MY_LOCAL_PASTELID;
  },

  getPassphrase(): string | null {
    return this.MY_PASTELID_PASSPHRASE;
  },
};

export default pastelGlobals;