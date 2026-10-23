/**
 * The papers a shipment is about — the parts both places need.
 *
 * Two screens attach documents: the shipment page, where the shipment already
 * exists and a file can go straight up, and the booking form, where it does
 * not exist yet and the files wait for it. They agree on what a document is,
 * what may be attached and how a picture of one is shown, so that lives here
 * rather than twice.
 */

export type ShipmentDocument = {
	id: string;
	url: string;
	name: string;
	kind?: string | null;
	note?: string | null;
	uploadedAt?: string;
	uploadedBy?: string;
};

/** A file chosen before the shipment exists, waiting for its id. */
export type PendingDocument = {
	file: File;
	kind: string;
	note: string;
};

/* The ones people actually attach. Free text underneath, because the next kind
   nobody has thought of should not need a deploy. */
export const DOCUMENT_KINDS = ["AWB", "Invoice", "Packing list", "Photo", "Customs", "Other"];

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_ACCEPT = "application/pdf,image/*";

export const overSize = (file: File) => file.size > MAX_DOCUMENT_BYTES;

/** A data URL, which is what the API takes. */
export const asDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error("That file could not be read"));
		reader.readAsDataURL(file);
	});

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|heic|heif|tiff?)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;

const isCloudinary = (url?: string) => /res\.cloudinary\.com\/[^/]+\/(image|raw)\/upload\//.test(url ?? "");

/** A PDF, by either its link or the name it was attached under. */
export const isPdf = (doc: { url?: string; name?: string }) =>
	PDF_EXT.test(doc.url ?? "") || PDF_EXT.test(doc.name ?? "");

/**
 * A picture — one an <img> can actually render.
 *
 * The extension decides, and it decides against a PDF first. Cloudinary stores
 * a PDF under /image/upload/ like everything else it can rasterise, so taking
 * that path as proof of an image put waybills into an <img> tag, where they
 * came out as a broken-image mark on a dark screen. A Cloudinary path is only
 * read as a hint once the obvious non-images are ruled out.
 */
export const isImage = (doc: { url?: string; name?: string }) => {
	if (isPdf(doc)) return false;
	if (IMAGE_EXT.test(doc.url ?? "") || IMAGE_EXT.test(doc.name ?? "")) return true;
	return isCloudinary(doc.url) && !/\.(zip|docx?|xlsx?|csv|txt)(\?|#|$)/i.test(doc.url ?? "");
};

/** Anything we can show on the page rather than hand to another tab. */
export const canPreview = (doc: { url?: string; name?: string }) => isImage(doc) || (isPdf(doc) && isCloudinary(doc.url));

/**
 * What to put in the <img> when the document is opened.
 *
 * A PDF is not an image, but Cloudinary will draw its first page as one, which
 * is what somebody checking "is this the right waybill?" actually wants — and
 * it arrives in a moment rather than as a download. The original is always one
 * tap away for the rest of the pages.
 */
export const previewUrl = (url: string) =>
	PDF_EXT.test(url) && isCloudinary(url)
		? url.replace("/upload/", "/upload/pg_1,f_jpg,q_auto/").replace(/\.pdf(\?|#|$)/i, ".jpg$1")
		: url;

/**
 * The same file, as a download rather than something the browser opens.
 *
 * The `download` attribute is ignored across origins, so a tap on a Cloudinary
 * link opens the file instead of saving it. fl_attachment makes Cloudinary send
 * it with Content-Disposition: attachment, which every browser does save.
 */
export const downloadUrl = (url: string) =>
	isCloudinary(url) ? url.replace("/upload/", "/upload/fl_attachment/") : url;

/**
 * A small version of a picture, for the list.
 *
 * Cloudinary will cut one to size on delivery, so a 4 MB photograph of a pallet
 * does not travel in full to fill a 56px square. Anything hosted elsewhere is
 * used as it is and sized by CSS.
 */
export const thumbUrl = (url: string, px = 112) =>
	/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)
		? url.replace("/upload/", `/upload/c_fill,g_auto,w_${px},h_${px},q_auto,f_auto/`)
		: url;

/** The date a document arrived, as a person writes it. */
export const documentDate = (iso?: string) => {
	if (!iso) return "";
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? ""
		: d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** "2.4 MB" — so somebody who has hit the limit can see which file did it. */
export const fileSize = (bytes: number) =>
	bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Why a document did not go up, in words that name the next move.
 *
 * "That did not upload" is the message a person can do nothing with, and it
 * hid a 413 for every real waybill: the server was refusing the request body
 * before the route ran, and nothing on the screen said so. The status is the
 * most reliable thing an upload failure carries, so it is read first and the
 * server's own message only used when it says more.
 */
export const uploadFailureReason = (err: unknown) => {
	const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
	const status = e?.response?.status;
	const said = e?.response?.data?.message;
	if (status === 413) return "the file is too large to send — attach a smaller copy";
	if (status === 403) return "you cannot attach to this shipment";
	if (status === 404) return "the shipment could not be found";
	if (status === 502) return "the upload service refused it — try again";
	if (said) return said;
	if (!status) return "we could not reach the server";
	return `the server answered ${status}`;
};
