"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { IconCopy, IconLoader2, IconPhotoUp } from "@tabler/icons-react";
import { useCompletion } from "ai/react";
import { toast } from "sonner";
import Image from "next/image";
import { isSupportedImageType } from "@/app/utils";
import { useLongPress } from "use-long-press";

export default function Home() {
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [blobURL, setBlobURL] = useState<string | null>(null);
	const [finished, setFinished] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const { complete, completion, isLoading } = useCompletion({
		onError: (e) => {
			toast.error(e.message);
			setBlobURL(null);
		},
		onFinish: () => setFinished(true),
	});

	async function submit(file?: File | Blob) {
		if (!file) return;

		if (!isSupportedImageType(file.type)) {
			return toast.error(
				"Unsupported format. Only JPEG, PNG, GIF, and WEBP files are supported."
			);
		}

		if (file.size > 4.5 * 1024 * 1024) {
			return toast.error("Image too large, maximum file size is 4.5MB.");
		}

		const base64 = await toBase64(file);

		// roughly 4.5MB in base64
		if (base64.length > 6_464_471) {
			return toast.error("Image too large, maximum file size is 4.5MB.");
		}

		setBlobURL(URL.createObjectURL(file));
		setFinished(false);
		complete(base64);
	}

	function handleDragLeave() {
		setIsDraggingOver(false);
	}

	function handleDragOver(e: DragEvent) {
		setIsDraggingOver(true);
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		setIsDraggingOver(false);

		const file = e.dataTransfer?.files?.[0];
		submit(file);
	}

	useEffect(() => {
		addEventListener("paste", handlePaste);
		addEventListener("drop", handleDrop);
		addEventListener("dragover", handleDragOver);
		addEventListener("dragleave", handleDragLeave);

		return () => {
			removeEventListener("paste", handlePaste);
			removeEventListener("drop", handleDrop);
			removeEventListener("dragover", handleDragOver);
			removeEventListener("dragleave", handleDragLeave);
		};
	});

	async function handlePaste(e: ClipboardEvent) {
		const file = e.clipboardData?.files?.[0];
		submit(file);
	}

	async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		submit(file);
	}

	const [description, text] = completion.split("▲");

	function copyBoth() {
		navigator.clipboard.writeText([description, text].join("\n"));
		toast.success("Copied to clipboard");
	}

	const bind = useLongPress(async () => {
		try {
			if (!navigator.clipboard.read)
				return toast.error(
					"Your browser does not support reading from the clipboard."
				);

			const items = await navigator.clipboard.read();
			const item = items[0];

			const supportedType = item.types.find(isSupportedImageType);
			if (!supportedType) {
				return toast.error(
					"Unsupported format. Only JPEG, PNG, GIF, and WEBP files are supported."
				);
			}

			const blob = await item.getType(supportedType);
			submit(blob);
		} catch {
			toast.error("Permission to read clipboard was denied.");
		}
	});

	return (
		<main
			className="grow flex items-center justify-center py-6"
			{...bind()}
		>
			<div className="flex flex-col lg:flex-row gap-3 w-full justify-center">
				<div
					className={clsx(
						"h-72 md:h-96 lg:max-w-xl rounded-lg border-4 drop-shadow-sm text-gray-700 dark:text-gray-300 cursor-pointer border-dashed transition-colors ease-in-out bg-gray-100 dark:bg-gray-900 relative w-full group",
						{
							"border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700":
								!isDraggingOver,
							"border-blue-300 dark:border-blue-700":
								isDraggingOver,
						}
					)}
					onClick={() => inputRef.current?.click()}
				>
					{blobURL && (
						<Image
							src={blobURL}
							unoptimized
							fill
							className="object-contain"
							alt="Uploaded image"
						/>
					)}

					<div
						className={clsx(
							"pointer-events-none flex flex-col w-full h-full p-3 items-center justify-center text-center absolute bg-gray-100/70 dark:bg-gray-900/70",
							{
								"opacity-0 group-hover:opacity-100 transition ease-in-out":
									completion,
							}
						)}
					>
						{isLoading ? (
							<IconLoader2 className="size-12 pointer-events-none animate-spin mb-4" />
						) : (
							<IconPhotoUp className="size-12 pointer-events-none mb-4" />
						)}
						<p className="hidden lg:block">
							drop <Or /> paste <Or /> click to upload
						</p>
						<p className="lg:hidden">
							tap to upload <Or /> hold to paste
						</p>
						<p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
							(images are not stored)
						</p>
					</div>

					<input
						type="file"
						className="hidden"
						ref={inputRef}
						onChange={handleInputChange}
						accept="image/jpeg, image/png, image/gif, image/webp"
					/>
				</div>

				{(isLoading || completion) && (
					<div className="space-y-3 w-full lg:max-w-96">
						<Section finished={finished} content={description}>
							Description
						</Section>
						<Section finished={finished} content={text}>
							Text
						</Section>
						{finished && text && (
							<button
								onClick={copyBoth}
								className="w-full lg:w-auto rounded-md bg-blue-200 dark:bg-blue-800 px-3 py-2"
							>
								Copy Both
							</button>
						)}
					</div>
				)}
			</div>
		</main>
	);
}

const Or = () => (
	<span className="text-gray-600 dark:text-gray-400 font-mono">or</span>
);

function toBase64(file: File | Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			if (typeof reader.result !== "string") return;
			resolve(reader.result);
		};
		reader.onerror = (error) => reject(error);
	});
}

function Section({
	children,
	content,
	finished,
}: {
	children: string;
	content?: string;
	finished: boolean;
}) {
	function copy() {
		navigator.clipboard.writeText(content || "");
		toast.success("Copied to clipboard");
	}

	const loading = !content && !finished;

	return (
		<div className="p-3 rounded-md bg-gray-100 dark:bg-gray-900 w-full drop-shadow-sm">
			{content && (
				<button
					className="float-right rounded-md p-1 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ease-in-out"
					onClick={copy}
					aria-label="Copy to clipboard"
				>
					<IconCopy />
				</button>
			)}
			<h2 className="text-xl font-semibold">{children}</h2>

			{loading && (
				<div className="bg-gray-200 dark:bg-gray-800 animate-pulse rounded w-full h-6" />
			)}
			{content && <p className="whitespace-pre-line">{content.trim()}</p>}
			{finished && !content && (
				<p className="text-gray-700 dark:text-gray-300">
					No text was found in that image.
				</p>
			)}
		</div>
	);
}
