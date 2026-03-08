<script lang="ts">
    import { errorStore, errorHandler } from '../../utils/error-handler';
    import { fly, fade } from 'svelte/transition';
    import { onMount } from 'svelte';

    let errors = [];

    onMount(() => {
        return errorStore.subscribe(value => {
            errors = value;
        });
    });

    function dismiss(timestamp: number) {
        errorHandler.dismissError(timestamp);
    }
</script>

<div class="fixed top-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
    {#each errors as error (error.timestamp)}
        <div
            in:fly={{ x: 20, duration: 300 }}
            out:fade
            class="pointer-events-auto min-w-[300px] max-w-sm rounded-lg shadow-lg border-l-4 p-4 bg-white dark:bg-gray-800 text-sm"
            class:border-blue-500={error.level === 'info'}
            class:border-yellow-500={error.level === 'warning'}
            class:border-red-500={error.level === 'error' || error.level === 'fatal'}
            role="alert"
        >
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold" class:text-blue-500={error.level === 'info'} class:text-yellow-500={error.level === 'warning'} class:text-red-500={error.level === 'error' || error.level === 'fatal'}>
                        {error.code !== '500' ? `Error ${error.code}` : 'Error'}
                    </h3>
                    <p class="mt-1 text-gray-600 dark:text-gray-300">{error.message}</p>
                </div>
                <button
                    on:click={() => dismiss(error.timestamp)}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Close"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            {#if error.retry}
                <button
                    on:click={error.retry}
                    class="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                    Retry / 重试
                </button>
            {/if}
        </div>
    {/each}
</div>
