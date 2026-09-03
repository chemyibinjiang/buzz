import 'package:buzz/shared/custom_emoji/custom_emoji.dart';
import 'package:buzz/shared/custom_emoji/custom_emoji_render.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gpt_markdown/custom_widgets/markdown_config.dart';

const _palette = [
  CustomEmoji(shortcode: 'wave', url: 'https://example.com/wave.png'),
  CustomEmoji(shortcode: 'wave_long', url: 'https://example.com/long.png'),
  CustomEmoji(
    shortcode: 'party-parrot',
    url: 'https://example.com/parrot.png',
  ),
];

void main() {
  test('pattern is bounded by referenced emoji, not the full palette', () {
    final largePalette = [
      ..._palette,
      for (var i = 0; i < 2500; i++)
        CustomEmoji(shortcode: 'unused_$i', url: 'https://example.com/$i.png'),
    ];
    final small = CustomEmojiMd(_palette, content: 'hello :wave:');
    final large = CustomEmojiMd(largePalette, content: 'hello :wave:');

    expect(large.exp.pattern, small.exp.pattern);
    expect(large.exp.hasMatch(':wave:'), isTrue);
    expect(large.exp.hasMatch(':wave_long:'), isFalse);
    expect(large.exp.hasMatch(':unused_2499:'), isFalse);
  });

  test('selection preserves matching across shared-colon boundaries', () {
    final matcher = CustomEmojiMd(
      _palette,
      content: ':unknown:wave: :wave:unknown:wave_long:',
    );

    expect(
      matcher.exp
          .allMatches(':unknown:wave: :wave:unknown:wave_long:')
          .map((match) => match.group(0))
          .toList(),
      [':wave:', ':wave_long:'],
    );
  });

  testWidgets('known tokens retain their URL and size', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    final context = tester.element(find.byType(SizedBox));
    final matcher = CustomEmojiMd(
      _palette,
      content: ':WAVE: :unknown:',
      size: 32,
    );

    final known = matcher.span(context, ':WAVE:', GptMarkdownConfig());
    expect(known, isA<WidgetSpan>());
    final image = (known as WidgetSpan).child as CustomEmojiImage;
    expect(image.shortcode, 'wave');
    expect(image.url, 'https://example.com/wave.png');
    expect(image.size, 32);

    final unknown = matcher.span(context, ':unknown:', GptMarkdownConfig());
    expect(unknown, isA<TextSpan>());
    expect((unknown as TextSpan).text, ':unknown:');
  });
}
