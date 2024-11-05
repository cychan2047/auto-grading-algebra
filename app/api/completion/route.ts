import { streamText, StreamingTextResponse } from "ai";
import { isSupportedImageType } from "@/app/utils";
import { google } from "@ai-sdk/google";

const prompt_task = `
  You are given an image of a handwritten answer of a middle school algebra question from a middle school student. 
  In the answer there is some irrelevant words that could be in any language or some deleted expressions. 

  Please do the following: 
  1. Recognize the original problem and the type of the problem. 
  2. Recognize the expressions in each step and its correctness. 
  3. Justify if the final answer is correct. 
  4. Generate a rubrics with 5 total points for this question. 
  5. Justify how many points will you award each item in the rubrics and calculate the final score.
`;

export async function POST(req: Request) {
	const { prompt } = await req.json();

	// roughly 4.5MB in base64
	if (prompt.length > 6_464_471) {
		return new Response("Image too large, maximum file size is 4.5MB.", {
			status: 400,
		});
	}

	const { mimeType, image } = decodeBase64Image(prompt);

	if (!mimeType || !image)
		return new Response("Invalid image data", { status: 400 });

	if (!isSupportedImageType(mimeType)) {
		return new Response(
			"Unsupported format. Only JPEG, PNG, GIF, and WEBP files are supported.",
			{ status: 400 }
		);
	}

	const result = await streamText({
		messages: [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: prompt_task,
					},
					{
						type: "image",
						image,
						mimeType,
					},
				],
			},
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "▲",
					},
				],
			},
		],
		model: google("models/gemini-1.5-pro-latest"),
	});

	return new StreamingTextResponse(result.toAIStream());
}

function decodeBase64Image(dataString: string) {
	const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

	return {
		mimeType: matches?.[1],
		image: matches?.[2],
	};
}
