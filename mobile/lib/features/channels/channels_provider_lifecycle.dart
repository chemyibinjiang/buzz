part of 'channels_provider.dart';

extension _ChannelsNotifierLiveSubscriptions on ChannelsNotifier {
  Future<void> _subscribeLive(List<Channel> channels) {
    final channelIds = {
      for (final channel in channels)
        if (channel.isMember && !channel.isArchived) channel.id,
    };
    final relayBaseUrl = _lifecycleRef.read(relayConfigProvider).baseUrl;
    _desiredLiveChannelIds = channelIds;
    final desiredKeys = _chunkLiveChannelIds(
      channelIds,
    ).map(_liveChunkKey).toSet();
    _terminallyClosedLiveChunks.retainAll(desiredKeys);
    final subscriptionVersion = ++_subscriptionVersion;

    final sync = _liveSubscriptionQueue.then(
      (_) =>
          _syncLiveSubscriptions(relayBaseUrl, subscriptionVersion, channels),
    );
    _liveSubscriptionQueue = sync
        .whenComplete(() {
          if (_lifecycleRef.mounted) _removeUndesiredLiveChunks();
        })
        .catchError((Object error, StackTrace stack) {
          debugPrint(
            '[ChannelsNotifier] live subscription sync failed: $error\n$stack',
          );
        });
    return _liveSubscriptionQueue;
  }

  Future<void> _syncLiveSubscriptions(
    String relayBaseUrl,
    int subscriptionVersion,
    List<Channel> channels,
  ) async {
    if (!_lifecycleRef.mounted ||
        _lifecycleRef.read(relaySessionProvider).status !=
            SessionStatus.connected ||
        subscriptionVersion != _subscriptionVersion) {
      return;
    }

    if (_subscriptionRelayBaseUrl != relayBaseUrl) {
      _clearRetainedLiveChunks();
      _subscriptionRelayBaseUrl = relayBaseUrl;
    }
    if (_lifecycleRef.read(relayConfigProvider).baseUrl != relayBaseUrl) return;
    final session = _lifecycleRef.read(relaySessionProvider.notifier);
    for (final chunk in _chunkLiveChannelIds(_desiredLiveChannelIds)) {
      final chunkKey = _liveChunkKey(chunk);
      if (_lifecycleRef.read(relaySessionProvider).status !=
          SessionStatus.connected) {
        return;
      }
      if (_liveSubscriptionsByChunk.containsKey(chunkKey) ||
          _terminallyClosedLiveChunks.contains(chunkKey)) {
        continue;
      }
      final generation = ++_nextLiveChunkGeneration;
      final subscription = _LiveChunkSubscription(generation);
      _liveSubscriptionsByChunk[chunkKey] = subscription;
      try {
        final unsubscribe = await session.subscribe(
          NostrFilter(
            kinds: EventKind.channelEventKinds,
            tags: {'#h': chunk},
            limit: 0,
          ),
          (event) {
            if (_lifecycleRef.mounted &&
                _subscriptionRelayBaseUrl == relayBaseUrl &&
                _desiredLiveChannelIds.contains(event.channelId)) {
              _handleLiveEvent(event);
            }
          },
          onClosed: (message) =>
              _handleLiveChunkClosed(chunkKey, generation, message),
        );
        subscription.unsubscribe = unsubscribe;
        if (!_lifecycleRef.mounted ||
            _lifecycleRef.read(relaySessionProvider).status !=
                SessionStatus.connected ||
            subscriptionVersion != _subscriptionVersion ||
            !chunk.every(_desiredLiveChannelIds.contains) ||
            _lifecycleRef.read(relayConfigProvider).baseUrl != relayBaseUrl ||
            _subscriptionRelayBaseUrl != relayBaseUrl) {
          _liveSubscriptionsByChunk.remove(chunkKey);
          unsubscribe();
          return;
        }
        if (_liveSubscriptionsByChunk[chunkKey] != subscription) {
          unsubscribe();
        }
      } catch (error) {
        if (_liveSubscriptionsByChunk[chunkKey] == subscription) {
          _liveSubscriptionsByChunk.remove(chunkKey);
        }
        if (!_lifecycleRef.mounted) return;
        debugPrint(
          '[ChannelsNotifier] live subscription failed for '
          '${chunk.length} channels: $error',
        );
      }
    }

    if (!_lifecycleRef.mounted ||
        _lifecycleRef.read(relaySessionProvider).status !=
            SessionStatus.connected ||
        subscriptionVersion != _subscriptionVersion) {
      return;
    }

    unawaited(_catchUpUnreadEvents(channels));
    _backstopTimer?.cancel();
    _backstopTimer = Timer.periodic(
      ChannelsNotifier._backstopInterval,
      (_) => _backstopRefresh(),
    );
  }

  void _handleLiveChunkClosed(String key, int generation, String message) {
    if (!_lifecycleRef.mounted) return;
    final subscription = _liveSubscriptionsByChunk[key];
    if (subscription == null || subscription.generation != generation) return;
    _liveSubscriptionsByChunk.remove(key);
    if (_chunkLiveChannelIds(
      _desiredLiveChannelIds,
    ).any((chunk) => _liveChunkKey(chunk) == key)) {
      _terminallyClosedLiveChunks.add(key);
    }
    debugPrint('[ChannelsNotifier] live subscription closed: $message');
  }

  void _removeUndesiredLiveChunks() {
    final desiredKeys = _chunkLiveChannelIds(
      _desiredLiveChannelIds,
    ).map(_liveChunkKey).toSet();
    final missingIds = <String>{};
    for (final chunk in _chunkLiveChannelIds(_desiredLiveChannelIds)) {
      if (!_liveSubscriptionsByChunk.containsKey(_liveChunkKey(chunk))) {
        missingIds.addAll(chunk);
      }
    }
    for (final entry in _liveSubscriptionsByChunk.entries.toList()) {
      if (desiredKeys.contains(entry.key)) continue;
      final covered = entry.key.split('\u0000').where(missingIds.contains);
      if (covered.isNotEmpty) {
        missingIds.removeAll(covered);
        continue;
      }
      _liveSubscriptionsByChunk.remove(entry.key);
      entry.value.unsubscribe?.call();
    }
  }

  void _clearRetainedLiveChunks() {
    for (final subscription in _liveSubscriptionsByChunk.values) {
      subscription.unsubscribe?.call();
    }
    _liveSubscriptionsByChunk.clear();
  }

  void _clearLiveSubscriptions() {
    _subscriptionVersion++;
    _desiredLiveChannelIds = const {};
    _terminallyClosedLiveChunks.clear();
    _clearRetainedLiveChunks();
    _subscriptionRelayBaseUrl = null;
    _backstopTimer?.cancel();
    _backstopTimer = null;
  }
}

List<List<String>> _chunkLiveChannelIds(Iterable<String> channelIds) {
  final sorted = channelIds.toList()..sort();
  return [
    for (
      var start = 0;
      start < sorted.length;
      start += ChannelsNotifier._maxLiveChannelsPerSubscription
    )
      sorted.sublist(
        start,
        min(
          start + ChannelsNotifier._maxLiveChannelsPerSubscription,
          sorted.length,
        ),
      ),
  ];
}

String _liveChunkKey(List<String> channelIds) => channelIds.join('\u0000');

class _LiveChunkSubscription {
  _LiveChunkSubscription(this.generation);

  final int generation;
  void Function()? unsubscribe;
}
