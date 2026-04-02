<script lang="ts">
	import I18nKey from "@i18n/i18nKey";
	import { i18n } from "@i18n/translation";
	import { onMount } from "svelte";

	interface Props {
		passwordHint?: string;
	}

	const { passwordHint = "" }: Props = $props();

	let errorMessage = $state("");
	let isLoading = $state(false);
	let password = $state("");
	let showHint = $state(false);
	let hasError = $state(false);

	function dispatchUnlock(password: string) {
		const event = new CustomEvent("password:unlock", {
			detail: { password },
			bubbles: true,
			composed: true,
		});
		document.dispatchEvent(event);
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (password.trim()) {
			dispatchUnlock(password);
		}
	}

	function handleKeypress(e: KeyboardEvent) {
		if (e.key === "Enter" && password.trim()) {
			dispatchUnlock(password);
		}
	}

	function toggleHint() {
		showHint = !showHint;
	}

	onMount(() => {
		const handleLoading = ((e: CustomEvent<boolean>) => {
			isLoading = e.detail;
		}) as EventListener;

		const handleError = ((e: CustomEvent<string>) => {
			errorMessage = e.detail;
			isLoading = false;
			hasError = true;
		}) as EventListener;

		const handleClearError = (() => {
			errorMessage = "";
			hasError = false;
		}) as EventListener;

		document.addEventListener("password:loading", handleLoading);
		document.addEventListener("password:error", handleError);
		document.addEventListener("password:clear-error", handleClearError);

		return () => {
			document.removeEventListener("password:loading", handleLoading);
			document.removeEventListener("password:error", handleError);
			document.removeEventListener(
				"password:clear-error",
				handleClearError,
			);
		};
	});
</script>

<div class="password-protection">
	<div class="password-container">
		<div class="lock-icon">
			<svg
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				class="w-12 h-12"
			>
				<path
					d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"
					fill="currentColor"
				></path>
			</svg>
		</div>
		<h2>{i18n(I18nKey.passwordProtectedTitle)}</h2>
		<p>{i18n(I18nKey.passwordProtectedDescription)}</p>
		<form class="password-input-group" onsubmit={handleSubmit}>
			<input
				type="password"
				id="password-input"
				placeholder={i18n(I18nKey.passwordPlaceholder)}
				class="password-input"
				class:error-shake={hasError}
				bind:value={password}
				onkeypress={handleKeypress}
				disabled={isLoading}
			/>
			<button
				id="unlock-btn"
				class="unlock-button"
				type="submit"
				disabled={isLoading}
			>
				{isLoading
					? i18n(I18nKey.passwordUnlocking)
					: i18n(I18nKey.passwordUnlock)}
			</button>
		</form>
		{#if errorMessage}
			<div class="error-message">{errorMessage}</div>
		{/if}
		{#if passwordHint}
			<div class="hint-section">
				<button
					type="button"
					class="hint-toggle"
					onclick={toggleHint}
					aria-expanded={showHint}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						class="hint-icon"
						class:rotated={showHint}
					>
						<path
							d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
							fill="currentColor"
						></path>
					</svg>
					<span>{i18n(I18nKey.passwordHintToggle)}</span>
				</button>
				{#if showHint}
					<div class="hint-content">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							class="hint-bulb"
						>
							<path
								d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"
								fill="currentColor"
							></path>
						</svg>
						<span class="hint-text">{passwordHint}</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.password-protection {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 60vh;
		padding: 2rem;
	}

	.password-container {
		text-align: center;
		max-width: 25rem;
		width: 100%;
		padding: 2rem;
		border-radius: 12px;
		background: transparent;
		border: 1px solid var(--line-divider);
		box-shadow: none;
	}

	.lock-icon {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
		color: var(--primary);
	}

	.lock-icon svg {
		width: 3rem;
		height: 3rem;
	}

	.password-container h2 {
		margin-bottom: 0.5rem;
		color: rgba(0, 0, 0, 0.85);
		font-size: 1.5rem;
	}

	:global(.dark) .password-container h2 {
		color: rgba(255, 255, 255, 0.85);
	}

	.password-container p {
		margin-bottom: 1.5rem;
		color: rgba(0, 0, 0, 0.75);
		opacity: 0.8;
	}

	:global(.dark) .password-container p {
		color: rgba(255, 255, 255, 0.75);
	}

	.password-input-group {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		align-items: stretch;
	}

	.password-input {
		flex: 1;
		min-width: 0;
		padding: 0.75rem 1rem;
		border: 1px solid var(--line-divider);
		border-radius: 8px;
		background: transparent;
		color: rgba(0, 0, 0, 0.85);
		font-size: 1rem;
		transition: border-color 0.2s ease;
	}

	:global(.dark) .password-input {
		color: rgba(255, 255, 255, 0.85);
	}

	.password-input::placeholder {
		color: rgba(0, 0, 0, 0.5);
	}

	:global(.dark) .password-input::placeholder {
		color: rgba(255, 255, 255, 0.5);
	}

	.password-input:focus {
		outline: none;
		border-color: var(--primary);
	}

	.password-input.error-shake {
		animation: shake 0.4s ease-in-out;
		border-color: #ef4444;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20%, 60% { transform: translateX(-5px); }
		40%, 80% { transform: translateX(5px); }
	}

	.unlock-button {
		padding: 0.75rem 1.5rem;
		background: transparent;
		color: var(--primary);
		border: 1px solid var(--primary);
		border-radius: 8px;
		font-size: 1rem;
		cursor: pointer;
		transition:
			border-color 0.2s,
			color 0.2s,
			background 0.2s;
		white-space: nowrap;
		flex-shrink: 0;
		min-width: fit-content;
		max-width: max-content;
	}

	.unlock-button:hover:not(:disabled) {
		background: var(--primary);
		color: white;
		border-color: var(--primary);
	}

	.unlock-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-message {
		color: #ef4444;
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.hint-section {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--line-divider);
	}

	.hint-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: transparent;
		border: none;
		color: var(--primary);
		font-size: 0.875rem;
		cursor: pointer;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		transition: background 0.2s ease;
	}

	.hint-toggle:hover {
		background: rgba(var(--primary-rgb, 59, 130, 246), 0.1);
	}

	.hint-icon {
		transition: transform 0.3s ease;
	}

	.hint-icon.rotated {
		transform: rotate(180deg);
	}

	.hint-content {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding: 0.75rem 1rem;
		background: rgba(var(--primary-rgb, 59, 130, 246), 0.08);
		border-radius: 8px;
		text-align: left;
		animation: fadeInHint 0.3s ease;
	}

	@keyframes fadeInHint {
		from {
			opacity: 0;
			transform: translateY(-5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.hint-bulb {
		flex-shrink: 0;
		color: var(--primary);
		margin-top: 0.125rem;
	}

	.hint-text {
		color: rgba(0, 0, 0, 0.75);
		font-size: 0.875rem;
		line-height: 1.5;
		word-break: break-word;
	}

	:global(.dark) .hint-text {
		color: rgba(255, 255, 255, 0.75);
	}

	@media (min-width: 769px) {
		.password-input-group {
			flex-wrap: nowrap;
		}

		.unlock-button {
			max-width: 40%;
		}
	}

	@media (max-width: 768px) {
		.password-protection {
			padding: 1rem;
			min-height: 50vh;
		}

		.password-container {
			max-width: none;
			width: 100%;
			padding: 1.5rem;
			margin: 0 0.5rem;
		}

		.password-container h2 {
			font-size: 1.25rem;
			margin-bottom: 0.75rem;
		}

		.password-container p {
			font-size: 0.9rem;
			margin-bottom: 1.25rem;
		}

		.password-input-group {
			flex-direction: column;
			gap: 0.75rem;
		}

		.password-input {
			padding: 0.875rem 1rem;
			font-size: 1rem;
			width: 100%;
		}

		.unlock-button {
			padding: 0.875rem 1rem;
			font-size: 1rem;
			max-width: 100%;
			width: 100%;
			white-space: nowrap;
		}

		.error-message {
			font-size: 0.8rem;
			text-align: center;
		}

		.hint-content {
			padding: 0.625rem 0.875rem;
		}

		.hint-text {
			font-size: 0.8rem;
		}
	}

	@media (max-width: 480px) {
		.password-protection {
			padding: 0.75rem;
		}

		.password-container {
			padding: 1.25rem;
			margin: 0 0.25rem;
		}

		.password-container h2 {
			font-size: 1.125rem;
		}

		.password-container p {
			font-size: 0.85rem;
		}

		.password-input {
			padding: 0.75rem 0.875rem;
			font-size: 0.95rem;
		}

		.unlock-button {
			padding: 0.75rem 0.875rem;
			font-size: 0.95rem;
		}
	}
</style>
