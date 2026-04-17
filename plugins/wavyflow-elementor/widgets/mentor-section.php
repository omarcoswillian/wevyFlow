<?php
namespace WavyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;

if (!defined('ABSPATH')) exit;

class Mentor_Section extends Widget_Base {
    public function get_name() { return 'wf-mentor-section'; }
    public function get_title() { return 'WavyFlow Mentor / Criador'; }
    public function get_icon() { return 'eicon-person'; }
    public function get_categories() { return ['wavyflow']; }

    protected function register_controls() {
        $this->start_controls_section('content', ['label' => 'Conteudo']);
        $this->add_control('label', ['label' => 'Label', 'type' => Controls_Manager::TEXT, 'default' => 'Quem criou']);
        $this->add_control('heading', ['label' => 'Titulo', 'type' => Controls_Manager::TEXT, 'default' => 'Criado por Os Formagios']);
        $this->add_control('heading_highlight', ['label' => 'Parte em destaque', 'type' => Controls_Manager::TEXT, 'default' => 'Os Formagios']);
        $this->add_control('numbers', ['label' => 'Numeros/autoridade', 'type' => Controls_Manager::TEXT, 'default' => '+5.000 alunos · +R$ 2M faturados com conteudo']);
        $this->add_control('bio_1', ['label' => 'Bio paragrafo 1', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Somos apaixonados por leitura e por ensinar pessoas a transformar conhecimento em resultado financeiro real.']);
        $this->add_control('bio_2', ['label' => 'Bio paragrafo 2', 'type' => Controls_Manager::TEXTAREA, 'default' => 'O Metodo RMX nasceu da nossa propria experiencia.']);
        $this->add_control('signature', ['label' => 'Assinatura', 'type' => Controls_Manager::TEXT, 'default' => 'Os Formagios · Criadores do RMX']);
        $this->add_control('photo', ['label' => 'Foto', 'type' => Controls_Manager::MEDIA]);
        $this->add_control('dark_mode', ['label' => 'Modo escuro', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $dark = ($s['dark_mode'] ?? '') === 'yes';
        $heading = esc_html($s['heading']);
        $hl = esc_html($s['heading_highlight']);
        if ($hl) $heading = str_replace($hl, '<em>' . $hl . '</em>', $heading);
        $hasPhoto = !empty($s['photo']['url']);
        ?>
        <div class="wf-block<?php echo $dark ? ' wf-block--dark' : ''; ?>">
            <div class="wf-content">
                <div class="wf-wrap">
                    <div class="wf-mentors wf-rv">
                        <div class="wf-mentors-media">
                            <?php if ($hasPhoto): ?>
                                <img src="<?php echo esc_url($s['photo']['url']); ?>" alt="Mentor">
                            <?php else: ?>
                                <div class="wf-ph"><span class="wf-ph-label">Foto do mentor</span></div>
                            <?php endif; ?>
                        </div>
                        <div class="wf-mentors-text">
                            <div class="wf-label"><?php echo esc_html($s['label']); ?></div>
                            <h2><?php echo $heading; ?></h2>
                            <?php if ($s['numbers']): ?>
                            <div class="wf-mentors-numbers"><?php echo esc_html($s['numbers']); ?></div>
                            <?php endif; ?>
                            <?php if ($s['bio_1']): ?><p><?php echo esc_html($s['bio_1']); ?></p><?php endif; ?>
                            <?php if ($s['bio_2']): ?><p><?php echo esc_html($s['bio_2']); ?></p><?php endif; ?>
                            <?php if ($s['signature']): ?>
                            <div class="wf-mentors-sig"><?php echo esc_html($s['signature']); ?></div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}
