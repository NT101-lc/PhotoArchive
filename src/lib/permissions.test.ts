import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDeleteAlbum,
  canDeletePhoto,
  canEditAlbum,
  canEditAlbumDate,
  canRenameSelf,
  canSetCover,
  canUpload,
  type Actor,
} from "./permissions";

const admin: Actor = { id: "a", name: "ADMIN", role: 0 };
const thao: Actor = { id: "t", name: "Thảo", role: 1 };
const hung: Actor = { id: "h", name: "Hưng", role: 1 };

describe("permissions", () => {
  it("anyone with a name can upload and edit dates; anonymous cannot", () => {
    for (const a of [admin, thao]) {
      assert.equal(canUpload(a), true);
      assert.equal(canEditAlbumDate(a), true);
    }
    assert.equal(canUpload(null), false);
    assert.equal(canEditAlbumDate(null), false);
  });

  it("only admin renames or deletes albums", () => {
    assert.equal(canEditAlbum(admin), true);
    assert.equal(canDeleteAlbum(admin), true);
    assert.equal(canEditAlbum(thao), false);
    assert.equal(canDeleteAlbum(thao), false);
    assert.equal(canDeleteAlbum(undefined), false);
  });

  it("cover: admin or the album creator", () => {
    const album = { createdById: thao.id };
    assert.equal(canSetCover(admin, album), true);
    assert.equal(canSetCover(thao, album), true);
    assert.equal(canSetCover(hung, album), false);
    assert.equal(canSetCover(null, album), false);
    assert.equal(canSetCover(hung, { createdById: null }), false);
  });

  it("delete photo: admin or the uploader", () => {
    const photo = { uploadedById: thao.id };
    assert.equal(canDeletePhoto(admin, photo), true);
    assert.equal(canDeletePhoto(thao, photo), true);
    assert.equal(canDeletePhoto(hung, photo), false);
    assert.equal(canDeletePhoto(hung, { uploadedById: null }), false);
  });

  it("users can rename themselves, the admin account cannot", () => {
    assert.equal(canRenameSelf(thao), true);
    assert.equal(canRenameSelf(admin), false);
    assert.equal(canRenameSelf(null), false);
  });
});
