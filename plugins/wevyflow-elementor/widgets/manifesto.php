<?php
namespace WevyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;

if (!defined('ABSPATH')) exit;

class Manifesto extends Widget_Base {
    public function get_name() { return 'wf-manifesto'; }
    public function get_title() { return 'WevyFlow Manifesto'; }
    public function get_icon() { return 'eicon-blockquote'; }
    public function get_categories() { return ['wevyflow']; }

    protected function register_controls() {
        $this->start_controls_section('content', ['label' => 'Conteudo']);
        $this->add_control('label', ['label' => 'Label', 'type' => Controls_Manager::TEXT, 'default' => 'Filosofia']);
        $this->add_control('text', ['label' => 'Texto do manifesto', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Leitura sem aplicacao e apenas entretenimento caro. Transforme conhecimento em resultado financeiro.']);
        $this->add_control('text_highlight', ['label' => 'Partes em italico (separar por |)', 'type' => Controls_Manager::TEXT, 'default' => 'Leitura sem aplicacao|resultado financeiro.']);
        $this->add_control('signature', ['label' => 'Assinatura', 'type' => Controls_Manager::TEXT, 'default' => '— Os Formagios']);
        $this->add_control('dark_mode', ['label' => 'Modo escuro', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $dark = ($s['dark_mode'] ?? '') === 'yes';
        $text = esc_html($s['text']);
        $highlights = array_map('trim', explode('|', $s['text_highlight']));
        foreach ($highlights as $hl) {
            if ($hl) $text = str_replace(esc_html($hl), '<em>' . esc_html($hl) . '</em>', $text);
        }
        ?>
        <div class="wf-block<?php echo $dark ? ' wf-block--dark' : ''; ?>">
            <div class="wf-manifesto">
                <div class="wf-manifesto-inner">
                    <div class="wf-manifesto-label"><?php echo esc_html($s['label']); ?></div>
                    <p class="wf-manifesto-text"><?php echo $text; ?></p>
                    <?php if ($s['signature']): ?>
                    <p class="wf-manifesto-sign"><?php echo esc_html($s['signature']); ?></p>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php
    }
}
